// Testes do servidor MCP de ponta a ponta, com cliente real do SDK ligado por
// transporte em memória (sem processo filho).

import { test, describe, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { criarServidor, FERRAMENTAS_LEITURA, FERRAMENTAS_ESCRITA } from '../src/servidor.mjs';
import { FIXTURE, copiarFixture, limpar } from './auxiliar.mjs';

/** Sobe servidor + cliente ligados em memória. */
async function ligar(opcoes) {
  const { servidor, cerebro } = criarServidor(opcoes);
  const [ladoCliente, ladoServidor] = InMemoryTransport.createLinkedPair();
  await servidor.connect(ladoServidor);
  const cliente = new Client({ name: 'teste', version: '0.0.0' });
  await cliente.connect(ladoCliente);
  return { cliente, servidor, cerebro, fechar: async () => { await cliente.close(); await servidor.close(); } };
}

const textoDe = (r) => r.content.map((c) => c.text).join('\n');

describe('servidor somente leitura', async () => {
  const s = await ligar({ dir: FIXTURE });
  after(() => s.fechar());

  test('lista só as 10 ferramentas de leitura', async () => {
    const { tools } = await s.cliente.listTools();
    const nomes = tools.map((t) => t.name).sort();
    assert.deepEqual(nomes, [...FERRAMENTAS_LEITURA].sort());
    for (const f of FERRAMENTAS_ESCRITA) assert.ok(!nomes.includes(f), f);
    assert.ok(tools.every((t) => t.description && t.inputSchema));
  });

  test('cerebro_contexto e cerebro_prioridades', async () => {
    const c = await s.cliente.callTool({ name: 'cerebro_contexto', arguments: {} });
    assert.match(textoDe(c), /contexto\/sobre-mim\.md/);
    assert.match(textoDe(c), /Prioridades do trimestre/);
    const p = await s.cliente.callTool({ name: 'cerebro_prioridades', arguments: {} });
    assert.match(textoDe(p), /fase 2/);
  });

  test('cerebro_rotas devolve o mapa', async () => {
    const r = await s.cliente.callTool({ name: 'cerebro_rotas', arguments: {} });
    assert.match(textoDe(r), /^## Mapa de rotas/);
  });

  test('cerebro_buscar devolve resultados ordenados com caminho e trecho', async () => {
    const r = await s.cliente.callTool({ name: 'cerebro_buscar', arguments: { consulta: 'empresa x', limite: 3 } });
    const t = textoDe(r);
    assert.match(t, /resultado\(s\) para "empresa x"/);
    assert.match(t, /1\. \*\*Empresa X\*\* — `wiki\/entidades\/empresa-x\.md`/);
    const nada = await s.cliente.callTool({ name: 'cerebro_buscar', arguments: { consulta: 'xyzabc123' } });
    assert.match(textoDe(nada), /Nada encontrado/);
  });

  test('cerebro_ler lê e bloqueia traversal com isError (sem derrubar o servidor)', async () => {
    const ok = await s.cliente.callTool({ name: 'cerebro_ler', arguments: { caminho: 'decisoes/registro.md' } });
    assert.match(textoDe(ok), /Plataforma do site novo/);
    for (const caminho of ['../../etc/passwd', '/etc/passwd', '.env', '.git/HEAD']) {
      const r = await s.cliente.callTool({ name: 'cerebro_ler', arguments: { caminho } });
      assert.equal(r.isError, true, caminho);
      assert.match(textoDe(r), /^Erro: Acesso negado/);
    }
    // continua vivo depois dos erros
    const depois = await s.cliente.callTool({ name: 'cerebro_ler', arguments: { caminho: 'conexoes.md' } });
    assert.match(textoDe(depois), /Planilha de receita/);
  });

  test('wiki, projetos, conexoes e rotinas', async () => {
    assert.match(textoDe(await s.cliente.callTool({ name: 'cerebro_wiki_indice', arguments: {} })), /\[\[empresa-x\]\]/);
    assert.match(textoDe(await s.cliente.callTool({ name: 'cerebro_wiki_pagina', arguments: { slug: 'empresa-x' } })), /Cliente principal/);
    const naoExiste = await s.cliente.callTool({ name: 'cerebro_wiki_pagina', arguments: { slug: 'zzz' } });
    assert.equal(naoExiste.isError, true);
    assert.match(textoDe(await s.cliente.callTool({ name: 'cerebro_projetos', arguments: {} })), /2 projeto\(s\)[\s\S]*Estado: em andamento/);
    assert.match(textoDe(await s.cliente.callTool({ name: 'cerebro_conexoes', arguments: {} })), /\| 1 \| Receita/);
    const rot = textoDe(await s.cliente.callTool({ name: 'cerebro_rotinas', arguments: {} }));
    assert.match(rot, /\| R1 \| Relatório semanal/);
    assert.match(rot, /\| 2026-08-29 09:12 \| R1 \| ok/);
  });

  test('recursos cerebro:// listam e leem notas, e recusam fora do cérebro', async () => {
    const lista = await s.cliente.listResources();
    const uris = lista.resources.map((r) => r.uri);
    assert.ok(uris.includes('cerebro://contexto/sobre-mim.md'));
    assert.ok(!uris.some((u) => u.includes('.claude')));
    const lido = await s.cliente.readResource({ uri: 'cerebro://wiki/entidades/empresa-x.md' });
    assert.match(lido.contents[0].text, /Cliente principal/);
    await assert.rejects(() => s.cliente.readResource({ uri: 'cerebro://../../etc/passwd' }), /Acesso negado/);
  });

  test('ferramenta de escrita não existe no modo leitura', async () => {
    // O SDK pode rejeitar (erro JSON-RPC) ou devolver isError — os dois são "não existe".
    let resultado;
    try {
      resultado = await s.cliente.callTool({ name: 'cerebro_registrar_decisao', arguments: { titulo: 'x', decisao: 'y', porque: 'z' } });
    } catch (e) {
      assert.match(String(e.message), /not found|cerebro_registrar_decisao/i);
      return;
    }
    assert.equal(resultado.isError, true);
    assert.match(textoDe(resultado), /not found|cerebro_registrar_decisao/i);
    assert.doesNotMatch(fs.readFileSync(path.join(FIXTURE, 'decisoes/registro.md'), 'utf8'), /: x\n/);
  });
});

describe('servidor com --escrita', async () => {
  const copia = copiarFixture();
  const s = await ligar({ dir: copia, escrita: true });
  after(async () => { await s.fechar(); limpar(copia); });

  test('lista as 13 ferramentas', async () => {
    const { tools } = await s.cliente.listTools();
    assert.deepEqual(tools.map((t) => t.name).sort(), [...FERRAMENTAS_LEITURA, ...FERRAMENTAS_ESCRITA].sort());
  });

  test('registra decisão, fonte e execução de verdade', async () => {
    const d = await s.cliente.callTool({ name: 'cerebro_registrar_decisao', arguments: { titulo: 'Teste via MCP', decisao: 'Sim.', porque: 'Porque sim.' } });
    assert.equal(d.isError, undefined);
    assert.match(fs.readFileSync(path.join(copia, 'decisoes/registro.md'), 'utf8'), /## \d{4}-\d{2}-\d{2}: Teste via MCP/);

    const f = await s.cliente.callTool({ name: 'cerebro_adicionar_fonte', arguments: { nome: 'Nota rápida', conteudo: 'Conteúdo.' } });
    const caminho = /Fonte gravada em (fontes\/\S+\.md)/.exec(textoDe(f))[1];
    assert.ok(fs.existsSync(path.join(copia, caminho)));

    const e = await s.cliente.callTool({ name: 'cerebro_registrar_execucao', arguments: { id: 'R1', resultado: 'ok' } });
    assert.match(textoDe(e), /Execução registrada/);
    assert.doesNotMatch(textoDe(e), /Aviso/);

    // validação de esquema: campo obrigatório ausente vira erro, não crash
    const invalido = await s.cliente.callTool({ name: 'cerebro_registrar_decisao', arguments: { titulo: 'só título' } });
    assert.equal(invalido.isError, true);
  });
});
