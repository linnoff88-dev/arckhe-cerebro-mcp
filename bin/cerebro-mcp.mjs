#!/usr/bin/env node
// CLI do cerebro-mcp.
//
//   cerebro-mcp [--dir <pasta>] [--escrita] [--http <porta>] [--host <ip>]
//
// Sem --http, fala MCP por stdio (é o que Claude Code, Codex e Claude Desktop usam).
// IMPORTANTE: em stdio, o stdout é do protocolo. Todo log vai para o stderr.

import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { resolverDir, ErroCerebro } from '../src/cerebro.mjs';
import { criarServidor, versao } from '../src/servidor.mjs';

const AJUDA = `cerebro-mcp ${versao()} — servidor MCP para um segundo cérebro (kit astra-2cerebro)

Uso:
  cerebro-mcp [opções]

Opções:
  --dir <pasta>     Pasta do cérebro (padrão: CEREBRO_DIR ou a pasta atual, se tiver AGENTS.md/CLAUDE.md)
  --escrita         Liga as ferramentas de escrita (ou CEREBRO_ESCRITA=1)
  --http <porta>    Sobe em HTTP (Streamable HTTP, POST /mcp) em vez de stdio
  --host <ip>       Endereço do HTTP (padrão 127.0.0.1; só mude se souber o que está fazendo)
  --versao          Mostra a versão
  --ajuda           Mostra esta ajuda
`;

function lerArgs(argv) {
  const opcoes = { dir: null, escrita: false, http: null, host: '127.0.0.1', ajuda: false, versao: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--dir') opcoes.dir = argv[++i];
    else if (a.startsWith('--dir=')) opcoes.dir = a.slice(6);
    else if (a === '--escrita' || a === '--write') opcoes.escrita = true;
    else if (a === '--http') opcoes.http = Number(argv[++i] ?? 3333);
    else if (a.startsWith('--http=')) opcoes.http = Number(a.slice(7));
    else if (a === '--host') opcoes.host = argv[++i];
    else if (a === '--versao' || a === '--version' || a === '-v') opcoes.versao = true;
    else if (a === '--ajuda' || a === '--help' || a === '-h') opcoes.ajuda = true;
    else {
      console.error(`Opção desconhecida: ${a}\n`);
      console.error(AJUDA);
      process.exit(2);
    }
  }
  return opcoes;
}

async function principal() {
  const opcoes = lerArgs(process.argv.slice(2));
  if (opcoes.ajuda) { console.error(AJUDA); return; }
  if (opcoes.versao) { console.error(versao()); return; }

  const escrita = opcoes.escrita || ['1', 'true', 'sim'].includes(String(process.env.CEREBRO_ESCRITA ?? '').toLowerCase());
  let dir;
  try {
    dir = resolverDir({ dir: opcoes.dir });
  } catch (e) {
    console.error(`[cerebro-mcp] ${e.message}`);
    process.exit(1);
  }

  if (opcoes.http !== null) {
    if (!Number.isInteger(opcoes.http) || opcoes.http < 0 || opcoes.http > 65535) {
      console.error('[cerebro-mcp] Porta inválida para --http.');
      process.exit(2);
    }
    const { iniciarHttp } = await import('../src/http.mjs');
    await iniciarHttp({ dir, escrita, porta: opcoes.http, host: opcoes.host });
    return;
  }

  const { servidor } = criarServidor({ dir, escrita });
  const transporte = new StdioServerTransport();
  await servidor.connect(transporte);
  console.error(`[cerebro-mcp] pronto por stdio — cérebro em ${dir} (escrita ${escrita ? 'ligada' : 'desligada'})`);
}

principal().catch((e) => {
  console.error(`[cerebro-mcp] ${e instanceof ErroCerebro ? e.message : e?.stack ?? e}`);
  process.exit(1);
});
