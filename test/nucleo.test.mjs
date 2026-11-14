// Testes do núcleo (src/cerebro.mjs) contra test/fixture — só leitura.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { Cerebro, ErroCerebro, resolverDir, normalizar, slugificar, dataLocal, extrairTabelas, extrairSecao } from '../src/cerebro.mjs';
import { FIXTURE, copiarFixture, limpar } from './auxiliar.mjs';

const cerebro = new Cerebro(FIXTURE);

describe('utilidades', () => {
  test('normalizar tira acentos e caixa', () => {
    assert.equal(normalizar('Decisão Ótima'), 'decisao otima');
  });
  test('slugificar gera nome de arquivo', () => {
    assert.equal(slugificar('Reunião com a Empresa X!'), 'reuniao-com-a-empresa-x');
    assert.equal(slugificar('   '), 'sem-nome');
  });
  test('dataLocal usa a data local, não UTC', () => {
    assert.equal(dataLocal(new Date(2026, 8, 7, 23, 30)), '2026-09-07');
  });
  test('extrairTabelas lê cabeçalho e linhas', () => {
    const [t] = extrairTabelas('| A | B |\n|---|---|\n| 1 | x \\| y |\n');
    assert.deepEqual(t.cabecalho, ['A', 'B']);
    assert.deepEqual(t.linhas, [{ A: '1', B: 'x | y' }]);
  });
  test('extrairSecao para no próximo título de mesmo nível', () => {
    const s = extrairSecao('# T\n## Um\na\n### Sub\nb\n## Dois\nc', /^um/i);
    assert.equal(s, '## Um\na\n### Sub\nb');
  });
});

describe('resolverDir', () => {
  test('aceita --dir válido', () => {
    assert.equal(resolverDir({ dir: FIXTURE, env: {} }), fs.realpathSync(FIXTURE));
  });
  test('aceita CEREBRO_DIR', () => {
    assert.equal(resolverDir({ env: { CEREBRO_DIR: FIXTURE } }), fs.realpathSync(FIXTURE));
  });
  test('usa a pasta atual se for um cérebro', () => {
    assert.equal(resolverDir({ env: {}, cwd: FIXTURE }), fs.realpathSync(FIXTURE));
  });
  test('erro claro quando a pasta não é um cérebro', () => {
    assert.throws(() => resolverDir({ dir: path.join(FIXTURE, 'fontes'), env: {} }), (e) => e instanceof ErroCerebro && e.codigo === 'NAO_E_CEREBRO');
    assert.throws(() => resolverDir({ dir: '/pasta/que/nao/existe', env: {} }), (e) => e.codigo === 'DIR_INEXISTENTE');
    assert.throws(() => resolverDir({ env: {}, cwd: path.join(FIXTURE, 'fontes') }), (e) => e.codigo === 'SEM_CEREBRO');
  });
});

describe('leitura e bloqueio de caminhos', () => {
  test('lê um arquivo relativo', () => {
    const r = cerebro.ler('contexto/sobre-mim.md');
    assert.match(r.conteudo, /Sou consultor/);
    assert.equal(r.caminho, 'contexto/sobre-mim.md');
  });
  test('lista uma pasta', () => {
    const r = cerebro.ler('wiki');
    assert.equal(r.diretorio, true);
    assert.ok(r.itens.includes('entidades'));
  });
  test('bloqueia path traversal e caminhos absolutos de fora', () => {
    for (const c of ['../../etc/passwd', '../fixture/../../package.json', '/etc/passwd', '..']) {
      assert.throws(() => cerebro.ler(c), (e) => e instanceof ErroCerebro && e.codigo === 'FORA_DO_CEREBRO', c);
    }
  });
  test('bloqueia .env, .git e node_modules', () => {
    for (const c of ['.env', '.env.local', 'contexto/.env', '.git/config', 'node_modules/x/package.json']) {
      assert.throws(() => cerebro.ler(c), (e) => e.codigo === 'CAMINHO_PROTEGIDO', c);
    }
  });
  test('arquivo inexistente dá NAO_ENCONTRADO (não vaza nada)', () => {
    assert.throws(() => cerebro.ler('nao-existe.md'), (e) => e.codigo === 'NAO_ENCONTRADO');
  });
  test('symlink apontando para fora do cérebro é recusado', () => {
    const copia = copiarFixture();
    try {
      fs.symlinkSync('/etc', path.join(copia, 'fuga'));
      const c = new Cerebro(copia);
      assert.throws(() => c.ler('fuga/hostname'), (e) => e.codigo === 'FORA_DO_CEREBRO');
      assert.throws(() => c.ler('fuga'), (e) => e.codigo === 'FORA_DO_CEREBRO');
    } finally {
      limpar(copia);
    }
  });
});

describe('leituras de alto nível', () => {
  test('contexto concatena os três arquivos com caminho', () => {
    const c = cerebro.contexto();
    assert.equal(c.partes.length, 3);
    assert.match(c.texto, /<!-- contexto\/sobre-mim\.md -->/);
    assert.match(c.texto, /<!-- contexto\/prioridades\.md -->/);
    assert.match(c.texto, /Consultoria de processos/);
  });
  test('prioridades devolve só o arquivo de prioridades', () => {
    const p = cerebro.prioridades();
    assert.match(p.conteudo, /Prioridades do trimestre/);
    assert.doesNotMatch(p.conteudo, /Sou consultor/);
  });
  test('rotas extrai a seção Mapa de rotas do AGENTS.md', () => {
    const r = cerebro.rotas();
    assert.equal(r.arquivo, 'AGENTS.md');
    assert.match(r.texto, /^## Mapa de rotas/);
    assert.match(r.texto, /decisoes\/registro\.md/);
    assert.doesNotMatch(r.texto, /## Base de conhecimento/);
  });
  test('rotas cai para CLAUDE.md quando não há AGENTS.md', () => {
    const copia = copiarFixture();
    try {
      fs.rmSync(path.join(copia, 'AGENTS.md'));
      const r = new Cerebro(copia).rotas();
      assert.equal(r.arquivo, 'CLAUDE.md');
      assert.match(r.texto, /Mapa de rotas/);
    } finally {
      limpar(copia);
    }
  });
  test('projetos lista cada README com estado', () => {
    const lista = cerebro.projetos();
    assert.deepEqual(lista.map((p) => p.nome), ['projeto-alfa', 'site-novo']);
    assert.match(lista[0].estado, /em andamento/);
    assert.match(lista[1].estado, /planejamento/);
    assert.equal(lista[1].atualizado, '2026-08-28');
  });
  test('conexoes devolve a tabela com linhas', () => {
    const c = cerebro.conexoes();
    assert.equal(c.linhas.length, 7);
    assert.equal(c.linhas[0].Ferramenta, 'Planilha de receita');
    assert.match(c.tabela, /^\| # \| Domínio/);
  });
  test('rotinas devolve ativas e execuções', () => {
    const r = cerebro.rotinas();
    assert.equal(r.ativas.length, 1);
    assert.equal(r.ativas[0].ID, 'R1');
    assert.equal(r.execucoes.length, 1);
    assert.equal(r.execucoes[0].Resultado, 'ok');
  });
  test('wiki: índice e página por slug (com e sem acento)', () => {
    assert.match(cerebro.wikiIndice().conteudo, /Índice da wiki/);
    assert.equal(cerebro.wikiPagina('empresa-x').caminho, 'wiki/entidades/empresa-x.md');
    assert.equal(cerebro.wikiPagina('segundo-cerebro').caminho, 'wiki/conceitos/segundo-cerebro.md');
    assert.equal(cerebro.wikiPagina('2026-09-01-reuniao-empresa-x').caminho, 'wiki/fontes/2026-09-01-reuniao-empresa-x.md');
    assert.equal(cerebro.wikiPagina('Segundo cérebro').caminho, 'wiki/conceitos/segundo-cerebro.md');
    assert.throws(() => cerebro.wikiPagina('nao-existe'), (e) => e.codigo === 'NAO_ENCONTRADO');
  });
});

describe('busca', () => {
  test('acha por termo no corpo e ignora acentos', () => {
    const r = cerebro.buscar('relatorios semanais');
    assert.ok(r.length > 0);
    assert.ok(r.some((x) => x.caminho === 'contexto/prioridades.md'));
    assert.ok(r.every((x) => typeof x.trecho === 'string'));
  });
  test('título pesa mais que corpo', () => {
    const r = cerebro.buscar('empresa x');
    assert.equal(r[0].caminho, 'wiki/entidades/empresa-x.md');
  });
  test('wikilinks contam', () => {
    const r = cerebro.buscar('projeto-alfa');
    const caminhos = r.map((x) => x.caminho);
    assert.ok(caminhos.includes('projetos/projeto-alfa/README.md'));
    assert.ok(caminhos.includes('contexto/sobre-mim.md'));
  });
  test('limite é respeitado e consulta vazia devolve nada', () => {
    assert.equal(cerebro.buscar('a', 3).length, 0);
    assert.ok(cerebro.buscar('empresa', 2).length <= 2);
  });
  test('não indexa .claude, .agents, apps nem node_modules', () => {
    const copia = copiarFixture();
    try {
      for (const p of ['.claude/skills/x', '.agents/skills/x', 'apps/cerebro-3d', 'node_modules/pkg']) {
        fs.mkdirSync(path.join(copia, p), { recursive: true });
        fs.writeFileSync(path.join(copia, p, 'SKILL.md'), '# marcador-secreto-zzz\nmarcador-secreto-zzz');
      }
      assert.equal(new Cerebro(copia).buscar('marcador-secreto-zzz').length, 0);
    } finally {
      limpar(copia);
    }
  });
});
