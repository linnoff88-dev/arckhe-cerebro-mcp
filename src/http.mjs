// Transporte HTTP (Streamable HTTP, sem sessão) para clientes que não falam stdio:
// n8n, bots, scripts, um site local. Escuta só em 127.0.0.1 por padrão.
//
// Cada requisição POST /mcp recebe um servidor + transporte novos (modo stateless):
// simples, sem estado entre chamadas, e suficiente para chamadas de ferramenta.

import http from 'node:http';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { criarServidor } from './servidor.mjs';

/**
 * Sobe o servidor HTTP.
 * @param {{dir: string, escrita?: boolean, porta?: number, host?: string, caminho?: string}} opcoes
 * @returns {Promise<http.Server>}
 */
export function iniciarHttp({ dir, escrita = false, porta = 3333, host = '127.0.0.1', caminho = '/mcp' }) {
  const servidorHttp = http.createServer(async (req, res) => {
    const url = new URL(req.url ?? '/', `http://${req.headers.host ?? host}`);

    // Verificação rápida de saúde, útil para n8n/monitoramento.
    if (req.method === 'GET' && url.pathname === '/saude') {
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ ok: true, servidor: 'cerebro-mcp', dir, escrita }));
      return;
    }

    if (url.pathname !== caminho) {
      res.writeHead(404, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ erro: `Use POST ${caminho}` }));
      return;
    }

    if (req.method !== 'POST') {
      // Sem sessão não há stream GET nem DELETE para encerrar.
      res.writeHead(405, { 'content-type': 'application/json', allow: 'POST' });
      res.end(JSON.stringify({ erro: 'Método não permitido. Envie JSON-RPC por POST.' }));
      return;
    }

    let corpo;
    try {
      corpo = JSON.parse(await lerCorpo(req));
    } catch {
      res.writeHead(400, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ erro: 'Corpo não é JSON válido.' }));
      return;
    }

    try {
      const { servidor } = criarServidor({ dir, escrita });
      const transporte = new StreamableHTTPServerTransport({
        sessionIdGenerator: undefined, // stateless: nenhuma sessão a manter
        enableJsonResponse: true,      // resposta JSON simples em vez de SSE
      });
      res.on('close', () => {
        transporte.close().catch(() => {});
        servidor.close().catch(() => {});
      });
      await servidor.connect(transporte);
      await transporte.handleRequest(req, res, corpo);
    } catch (e) {
      console.error('[cerebro-mcp] erro HTTP:', e?.message ?? e);
      if (!res.headersSent) {
        res.writeHead(500, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ erro: 'Falha interna ao processar a requisição.' }));
      }
    }
  });

  return new Promise((resolver, rejeitar) => {
    servidorHttp.once('error', rejeitar);
    servidorHttp.listen(porta, host, () => {
      const { port } = servidorHttp.address();
      console.error(`[cerebro-mcp] HTTP em http://${host}:${port}${caminho} (escrita ${escrita ? 'ligada' : 'desligada'})`);
      resolver(servidorHttp);
    });
  });
}

function lerCorpo(req) {
  return new Promise((resolver, rejeitar) => {
    const partes = [];
    let tamanho = 0;
    req.on('data', (p) => {
      tamanho += p.length;
      if (tamanho > 5 * 1024 * 1024) { // teto de 5 MB por requisição
        rejeitar(new Error('Corpo grande demais.'));
        req.destroy();
        return;
      }
      partes.push(p);
    });
    req.on('end', () => resolver(Buffer.concat(partes).toString('utf8')));
    req.on('error', rejeitar);
  });
}
