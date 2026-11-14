// Recursos MCP: cada .md do cérebro é exposto como cerebro://<caminho>.
// Clientes que preferem "anexar arquivo" em vez de chamar ferramenta usam isto.

import { ResourceTemplate } from '@modelcontextprotocol/sdk/server/mcp.js';

/**
 * @param {import('@modelcontextprotocol/sdk/server/mcp.js').McpServer} servidor
 * @param {import('./cerebro.mjs').Cerebro} cerebro
 */
export function registrarRecursos(servidor, cerebro) {
  const modelo = new ResourceTemplate('cerebro://{+caminho}', {
    // Lista todos os .md do cérebro (o cliente pode navegar sem chamar ferramenta).
    list: async () => ({
      resources: cerebro.listarMarkdown().map((caminho) => ({
        uri: `cerebro://${caminho}`,
        name: caminho,
        mimeType: 'text/markdown',
      })),
    }),
  });

  servidor.registerResource(
    'nota',
    modelo,
    {
      title: 'Nota do cérebro',
      description: 'Um arquivo Markdown do segundo cérebro, pelo caminho relativo.',
      mimeType: 'text/markdown',
    },
    async (uri, { caminho }) => {
      // O mesmo filtro de segurança das ferramentas: nada fora do cérebro.
      const rel = decodeURIComponent(Array.isArray(caminho) ? caminho.join('/') : String(caminho));
      const r = cerebro.ler(rel);
      return {
        contents: [{ uri: uri.href, mimeType: r.diretorio ? 'text/plain' : 'text/markdown', text: r.conteudo }],
      };
    },
  );
}
