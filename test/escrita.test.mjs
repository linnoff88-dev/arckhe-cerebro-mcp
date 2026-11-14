// Testes das operações de escrita do núcleo, sempre numa cópia temporária da fixture.

import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { Cerebro, ErroCerebro, dataLocal } from '../src/cerebro.mjs';
import { copiarFixture, limpar } from './auxiliar.mjs';

let copia;
beforeEach(() => { copia = copiarFixture(); });
afterEach(() => limpar(copia));

describe('escrita desligada (padrão)', () => {
  test('todas as operações lançam ESCRITA_DESLIGADA e nada muda no disco', () => {
    const c = new Cerebro(copia);
    const antes = fs.readFileSync(path.join(copia, 'decisoes/registro.md'), 'utf8');
    assert.throws(() => c.registrarDecisao({ titulo: 'x', decisao: 'y', porque: 'z' }), (e) => e instanceof ErroCerebro && e.codigo === 'ESCRITA_DESLIGADA');
    assert.throws(() => c.adicionarFonte({ nome: 'x', conteudo: 'y' }), (e) => e.codigo === 'ESCRITA_DESLIGADA');
    assert.throws(() => c.registrarExecucao({ id: 'R1', resultado: 'ok' }), (e) => e.codigo === 'ESCRITA_DESLIGADA');
    assert.equal(fs.readFileSync(path.join(copia, 'decisoes/registro.md'), 'utf8'), antes);
    assert.equal(fs.readdirSync(path.join(copia, 'fontes')).length, 2);
  });
});

describe('escrita ligada', () => {
  test('registrarDecisao acrescenta entrada datada no formato do kit', () => {
    const c = new Cerebro(copia, { escrita: true });
    const r = c.registrarDecisao({ titulo: 'Usar MCP', decisao: 'Expor o cérebro por MCP.', porque: 'Um cérebro, vários clientes.', alternativas: 'Copiar arquivos.', responsavel: 'eu' });
    const texto = fs.readFileSync(path.join(copia, 'decisoes/registro.md'), 'utf8');
    assert.equal(r.data, dataLocal());
    assert.match(texto, new RegExp(`\\n## ${dataLocal()}: Usar MCP\\n\\n\\*\\*Decisão:\\*\\* Expor o cérebro por MCP\\.\\n\\n\\*\\*Por quê:\\*\\* Um cérebro, vários clientes\\.\\n\\n\\*\\*Alternativas consideradas:\\*\\* Copiar arquivos\\.\\n\\n\\*\\*Responsável:\\*\\* eu\\n$`));
    // as entradas antigas continuam lá
    assert.match(texto, /## 2026-08-20: Plataforma do site novo/);
    // campos obrigatórios
    assert.throws(() => c.registrarDecisao({ titulo: 'x', decisao: '', porque: 'y' }), (e) => e.codigo === 'CAMPOS_OBRIGATORIOS');
  });

  test('adicionarFonte grava fontes/AAAA-MM-DD-slug.md e nunca sobrescreve', () => {
    const c = new Cerebro(copia, { escrita: true });
    const a = c.adicionarFonte({ nome: 'Reunião de Kickoff', conteudo: 'Primeira linha.' });
    assert.equal(a.caminho, `fontes/${dataLocal()}-reuniao-de-kickoff.md`);
    assert.equal(fs.readFileSync(path.join(copia, a.caminho), 'utf8'), '# Reunião de Kickoff\n\nPrimeira linha.\n');
    const b = c.adicionarFonte({ nome: 'Reunião de Kickoff', conteudo: '# Já tem título\n\nOutra.' });
    assert.equal(b.caminho, `fontes/${dataLocal()}-reuniao-de-kickoff-2.md`);
    assert.equal(fs.readFileSync(path.join(copia, b.caminho), 'utf8'), '# Já tem título\n\nOutra.\n');
    assert.equal(fs.readFileSync(path.join(copia, a.caminho), 'utf8'), '# Reunião de Kickoff\n\nPrimeira linha.\n');
    const d = c.adicionarFonte({ nome: 'Reunião de Kickoff', conteudo: 'Terceira.' });
    assert.equal(d.caminho, `fontes/${dataLocal()}-reuniao-de-kickoff-3.md`);
  });

  test('registrarExecucao insere no topo da tabela e avisa sobre ID desconhecido', () => {
    const c = new Cerebro(copia, { escrita: true });
    const r = c.registrarExecucao({ id: 'R1', resultado: 'ok', saida: 'fontes/x.md', observacao: 'tem | pipe' });
    assert.equal(r.aviso, null);
    const linhas = fs.readFileSync(path.join(copia, 'rotinas/registro.md'), 'utf8').split('\n');
    const iSep = linhas.findIndex((l, i) => l.startsWith('|---') && linhas[i - 1].startsWith('| Data e hora'));
    assert.match(linhas[iSep + 1], /^\| \d{4}-\d{2}-\d{2} \d{2}:\d{2} \| R1 \| ok \| fontes\/x\.md \| tem \\\| pipe \|$/);
    assert.match(linhas[iSep + 2], /^\| 2026-08-29 09:12 \| R1 \|/); // a antiga desceu
    // a tabela de rotinas ativas ficou intacta
    assert.equal(c.rotinas().ativas.length, 1);
    assert.equal(c.rotinas().execucoes.length, 2);
    const r2 = c.registrarExecucao({ id: 'R9', resultado: 'falha' });
    assert.match(r2.aviso, /R9/);
  });
});
