// Ferramentas da wiki: índice e página por slug.

import { z } from 'zod';
import { texto, protegido } from './util.mjs';

/**
 * @param {import('@modelcontextprotocol/sdk/server/mcp.js').McpServer} servidor
 * @param {import('../cerebro.mjs').Cerebro} cerebro
 */
export function registrarFerramentasWiki(servidor, cerebro) {
  servidor.registerTool(
    'cerebro_wiki_indice',
    {
      title: 'Índice da wiki',
      description:
        'Devolve wiki/index.md, a porta de entrada do conhecimento interligado. ' +
        'Cada [[slug]] listado pode ser aberto com cerebro_wiki_pagina.',
      inputSchema: {},
    },
    protegido(async () => {
      const i = cerebro.wikiIndice();
      return texto(i.conteudo ?? `(${i.caminho} ausente: a wiki ainda não foi gerada)`);
    }),
  );

  servidor.registerTool(
    'cerebro_wiki_pagina',
    {
      title: 'Página da wiki',
      description:
        'Acha uma página da wiki pelo slug (o texto dentro de [[...]]), procurando em ' +
        'wiki/entidades, wiki/conceitos e wiki/fontes. Ignora acentos e maiúsculas. ' +
        'Devolve o conteúdo com frontmatter e os links de saída.',
      inputSchema: {
        slug: z.string().min(1).describe('Slug da página, ex.: "empresa-x" ou "segundo-cerebro".'),
      },
    },
    protegido(async ({ slug }) => {
      const p = cerebro.wikiPagina(slug);
      const links = p.wikilinks.length ? `\n\n<!-- links de saída: ${p.wikilinks.map((l) => `[[${l}]]`).join(' ')} -->` : '';
      return texto(`<!-- ${p.caminho} -->\n${p.conteudo.trim()}${links}`);
    }),
  );
}
