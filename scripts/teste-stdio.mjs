#!/usr/bin/env node
// Teste de fumaça por stdio: sobe o servidor de verdade como processo filho e
// manda JSON-RPC cru (initialize → notifications/initialized → tools/list →
// tools/call), conferindo cada resposta. Sai com código 1 se algo falhar.
//
//   node scripts/teste-stdio.mjs [pasta-do-cerebro] [--escrita]

import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const escrita = args.includes('--escrita');
const dir = args.find((a) => !a.startsWith('--')) ?? path.join(raiz, 'test', 'fixture');

const filho = spawn(process.execPath, [path.join(raiz, 'bin', 'cerebro-mcp.mjs'), '--dir', dir, ...(escrita ? ['--escrita'] : [])], {
  stdio: ['pipe', 'pipe', 'pipe'],
});

let buffer = '';
const pendentes = new Map();
filho.stdout.on('data', (pedaco) => {
  buffer += pedaco.toString('utf8');
  let i;
  while ((i = buffer.indexOf('\n')) >= 0) {
    const linha = buffer.slice(0, i).trim();
    buffer = buffer.slice(i + 1);
    if (!linha) continue;
    const msg = JSON.parse(linha);
    if (msg.id !== undefined && pendentes.has(msg.id)) {
      pendentes.get(msg.id)(msg);
      pendentes.delete(msg.id);
    }
  }
});
filho.stderr.on('data', (d) => process.stderr.write(`[servidor] ${d}`));

let proximoId = 1;
function chamar(method, params) {
  const id = proximoId++;
  return new Promise((resolver, rejeitar) => {
    const timer = setTimeout(() => rejeitar(new Error(`sem resposta para ${method}`)), 10000);
    pendentes.set(id, (msg) => { clearTimeout(timer); resolver(msg); });
    filho.stdin.write(JSON.stringify({ jsonrpc: '2.0', id, method, params }) + '\n');
  });
}
function notificar(method, params) {
  filho.stdin.write(JSON.stringify({ jsonrpc: '2.0', method, params }) + '\n');
}

function conferir(condicao, rotulo) {
  console.log(`${condicao ? 'OK ' : 'FALHOU'} ${rotulo}`);
  if (!condicao) process.exitCode = 1;
}

try {
  const init = await chamar('initialize', {
    protocolVersion: '2025-06-18',
    capabilities: {},
    clientInfo: { name: 'teste-stdio', version: '1.0.0' },
  });
  conferir(init.result?.serverInfo?.name === 'cerebro-mcp', `initialize → servidor ${init.result?.serverInfo?.name} ${init.result?.serverInfo?.version} (protocolo ${init.result?.protocolVersion})`);
  notificar('notifications/initialized', {});

  const lista = await chamar('tools/list', {});
  const nomes = (lista.result?.tools ?? []).map((t) => t.name);
  conferir(nomes.length === (escrita ? 13 : 10), `tools/list → ${nomes.length} ferramentas: ${nomes.join(', ')}`);

  const busca = await chamar('tools/call', { name: 'cerebro_buscar', arguments: { consulta: 'empresa x', limite: 2 } });
  const textoBusca = busca.result?.content?.[0]?.text ?? '';
  conferir(/resultado\(s\)/.test(textoBusca), `tools/call cerebro_buscar → ${textoBusca.split('\n')[0]}`);

  const rotas = await chamar('tools/call', { name: 'cerebro_rotas', arguments: {} });
  conferir(/Mapa de rotas/.test(rotas.result?.content?.[0]?.text ?? ''), 'tools/call cerebro_rotas → seção encontrada');

  const bloqueio = await chamar('tools/call', { name: 'cerebro_ler', arguments: { caminho: '../../etc/passwd' } });
  conferir(bloqueio.result?.isError === true, `tools/call cerebro_ler ../../etc/passwd → isError (${bloqueio.result?.content?.[0]?.text})`);

  const recursos = await chamar('resources/list', {});
  conferir((recursos.result?.resources ?? []).length > 0, `resources/list → ${recursos.result?.resources?.length} recursos cerebro://`);
} catch (e) {
  conferir(false, e.message);
} finally {
  filho.kill();
}
