#!/usr/bin/env node
// Teste de fumaça do modo HTTP: sobe o servidor em porta livre de 127.0.0.1 e
// faz as chamadas que um n8n/bot faria (initialize, tools/list, tools/call),
// inclusive uma tools/call "seca" sem initialize antes, para documentar o
// comportamento do modo stateless.
//
//   node scripts/teste-http.mjs [pasta-do-cerebro]

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { iniciarHttp } from '../src/http.mjs';

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dir = process.argv[2] ?? path.join(raiz, 'test', 'fixture');

const servidor = await iniciarHttp({ dir, porta: 0 });
const { port } = servidor.address();
const url = `http://127.0.0.1:${port}/mcp`;

function conferir(condicao, rotulo) {
  console.log(`${condicao ? 'OK ' : 'FALHOU'} ${rotulo}`);
  if (!condicao) process.exitCode = 1;
}

async function rpc(method, params, id = 1, cabecalhos = {}) {
  const resp = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json', accept: 'application/json, text/event-stream', ...cabecalhos },
    body: JSON.stringify({ jsonrpc: '2.0', id, method, params }),
  });
  const texto = await resp.text();
  let json = null;
  try { json = JSON.parse(texto); } catch { /* pode ser erro em texto */ }
  return { status: resp.status, json, texto };
}

try {
  const saude = await fetch(`http://127.0.0.1:${port}/saude`).then((r) => r.json());
  conferir(saude.ok === true, `GET /saude → ${JSON.stringify(saude)}`);

  const init = await rpc('initialize', { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'teste-http', version: '1.0.0' } });
  conferir(init.status === 200 && init.json?.result?.serverInfo?.name === 'cerebro-mcp', `POST initialize → ${init.status} ${init.json?.result?.serverInfo?.name}`);

  const lista = await rpc('tools/list', {}, 2);
  conferir(lista.status === 200 && lista.json?.result?.tools?.length === 10, `POST tools/list (sem initialize antes, stateless) → ${lista.status}, ${lista.json?.result?.tools?.length} ferramentas`);

  const chamada = await rpc('tools/call', { name: 'cerebro_prioridades', arguments: {} }, 3);
  conferir(chamada.status === 200 && /Prioridades/.test(chamada.json?.result?.content?.[0]?.text ?? ''), `POST tools/call cerebro_prioridades (seco) → ${chamada.status}`);

  const semAccept = await rpc('tools/list', {}, 4, { accept: 'application/json' });
  conferir(semAccept.status === 406, `POST sem "text/event-stream" no Accept → ${semAccept.status} (esperado 406)`);

  const get = await fetch(url).then((r) => r.status);
  conferir(get === 405, `GET /mcp → ${get} (esperado 405)`);
} catch (e) {
  conferir(false, e.message);
} finally {
  servidor.close();
}
