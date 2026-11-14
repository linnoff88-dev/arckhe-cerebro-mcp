// Ferramentas de leitura: contexto, prioridades, rotas, busca, leitura de arquivo,
// projetos, conexões e rotinas. Todas são somente-leitura e sempre registradas.

import { z } from 'zod';
import { texto, protegido, tabelaMarkdown } from './util.mjs';

/**
 * Registra as ferramentas de leitura no servidor MCP.
 * @param {import('@modelcontextprotocol/sdk/server/mcp.js').McpServer} servidor
 * @param {import('../cerebro.mjs').Cerebro} cerebro
 */
export function registrarFerramentasLeitura(servidor, cerebro) {
  servidor.registerTool(
    'cerebro_contexto',
    {
      title: 'Contexto do dono do cérebro',
      description:
        'Devolve quem é a pessoa, o que faz e quais são as prioridades: os arquivos ' +
        'contexto/sobre-mim.md, contexto/sobre-o-trabalho.md e contexto/prioridades.md, ' +
        'concatenados e identificados pelo caminho. Chame antes de responder qualquer ' +
        'pergunta que dependa de contexto pessoal ou de trabalho.',
      inputSchema: {},
    },
    protegido(async () => texto(cerebro.contexto().texto)),
  );

  servidor.registerTool(
    'cerebro_prioridades',
    {
      title: 'Prioridades do trimestre',
      description:
        'Devolve só contexto/prioridades.md, a fonte canônica das prioridades. ' +
        'Não invente prioridades que não estejam aqui.',
      inputSchema: {},
    },
    protegido(async () => {
      const p = cerebro.prioridades();
      return texto(p.conteudo ?? `(${p.caminho} ausente: o cérebro ainda não tem prioridades registradas)`);
    }),
  );

  servidor.registerTool(
    'cerebro_rotas',
    {
      title: 'Mapa de rotas',
      description:
        'Devolve a seção "Mapa de rotas" do AGENTS.md (ou CLAUDE.md): "se precisar de X, ' +
        'olhe em Y". Use para descobrir em que arquivo do cérebro uma informação vive.',
      inputSchema: {},
    },
    protegido(async () => {
      const r = cerebro.rotas();
      return texto(r.texto ?? `(${r.arquivo} existe, mas não tem a seção "Mapa de rotas")`);
    }),
  );

  servidor.registerTool(
    'cerebro_buscar',
    {
      title: 'Buscar no cérebro',
      description:
        'Busca por termos em todos os arquivos Markdown do cérebro (título, frontmatter, ' +
        'wikilinks e corpo). Ignora acentos e maiúsculas. Devolve caminho, título e um ' +
        'trecho, ordenados por relevância (título > caminho > wikilinks > corpo). ' +
        'Depois use cerebro_ler para abrir o arquivo inteiro.',
      inputSchema: {
        consulta: z.string().min(1).describe('Termos de busca, separados por espaço.'),
        limite: z.number().int().min(1).max(50).optional().describe('Quantidade máxima de resultados (padrão 10).'),
      },
    },
    protegido(async ({ consulta, limite }) => {
      const resultados = cerebro.buscar(consulta, limite ?? 10);
      if (resultados.length === 0) return texto(`Nada encontrado para "${consulta}".`);
      const linhas = resultados.map((r, i) => {
        const meta = [r.tipo && `tipo: ${r.tipo}`, r.atualizado && `atualizado: ${r.atualizado}`].filter(Boolean).join(', ');
        return `${i + 1}. **${r.titulo}** — \`${r.caminho}\`${meta ? ` (${meta})` : ''}\n   ${r.trecho || '(sem trecho)'}`;
      });
      return texto(`${resultados.length} resultado(s) para "${consulta}":\n\n${linhas.join('\n\n')}`);
    }),
  );

  servidor.registerTool(
    'cerebro_ler',
    {
      title: 'Ler arquivo do cérebro',
      description:
        'Devolve o conteúdo de um arquivo pelo caminho relativo à raiz do cérebro ' +
        '(ex.: "decisoes/registro.md", "wiki/entidades/empresa-x.md"). Se for uma pasta, ' +
        'lista o que há nela. Recusa caminhos fora do cérebro, .git, node_modules e .env.',
      inputSchema: {
        caminho: z.string().min(1).describe('Caminho relativo dentro do cérebro.'),
      },
    },
    protegido(async ({ caminho }) => {
      const r = cerebro.ler(caminho);
      if (r.diretorio) return texto(`Pasta ${r.caminho}/:\n${r.itens.map((i) => `- ${i}`).join('\n') || '(vazia)'}`);
      return texto(`<!-- ${r.caminho} -->\n${r.conteudo}`);
    }),
  );

  servidor.registerTool(
    'cerebro_projetos',
    {
      title: 'Projetos ativos',
      description:
        'Lista os projetos em projetos/<nome>/README.md com a linha de estado de cada um. ' +
        'Use cerebro_ler no caminho para ver o README completo.',
      inputSchema: {},
    },
    protegido(async () => {
      const lista = cerebro.projetos();
      if (lista.length === 0) return texto('Nenhum projeto em projetos/.');
      const linhas = lista.map((p) => `- **${p.titulo}** (\`${p.caminho}\`)${p.atualizado ? ` — atualizado ${p.atualizado}` : ''}\n  Estado: ${p.estado || '(não informado)'}`);
      return texto(`${lista.length} projeto(s):\n\n${linhas.join('\n')}`);
    }),
  );

  servidor.registerTool(
    'cerebro_conexoes',
    {
      title: 'Sistemas conectados',
      description:
        'Devolve a tabela de conexoes.md: quais sistemas (finanças, clientes, agenda, ' +
        'comunicação...) o cérebro alcança, por qual mecanismo e quando foram lidos pela última vez.',
      inputSchema: {},
    },
    protegido(async () => {
      const c = cerebro.conexoes();
      if (!c.tabela) return texto(`(${c.caminho} ausente ou sem tabela)`);
      return texto(`<!-- ${c.caminho} -->\n${c.tabela}`);
    }),
  );

  servidor.registerTool(
    'cerebro_rotinas',
    {
      title: 'Rotinas e execuções',
      description:
        'Devolve as rotinas ativas e as últimas execuções registradas em rotinas/registro.md ' +
        '(mais recentes primeiro).',
      inputSchema: {
        limite: z.number().int().min(1).max(100).optional().describe('Quantas execuções mostrar (padrão 10).'),
      },
    },
    protegido(async ({ limite }) => {
      const r = cerebro.rotinas(limite ?? 10);
      const partes = [`<!-- ${r.caminho} -->`, '## Rotinas ativas', ''];
      partes.push(r.ativas.length ? r.ativasBruto : '(nenhuma rotina ativa)');
      partes.push('', `## Últimas execuções (${r.execucoes.length})`, '');
      partes.push(r.execucoes.length ? r.execucoesBruto : '(nenhuma execução registrada)');
      return texto(partes.join('\n'));
    }),
  );
}

export { tabelaMarkdown };
