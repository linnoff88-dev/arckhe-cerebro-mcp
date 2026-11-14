// Ferramentas de escrita. Só são registradas quando o servidor sobe com --escrita
// (ou CEREBRO_ESCRITA=1). Mesmo assim, o núcleo confere a flag de novo antes de gravar.

import { z } from 'zod';
import { texto, protegido } from './util.mjs';

/**
 * @param {import('@modelcontextprotocol/sdk/server/mcp.js').McpServer} servidor
 * @param {import('../cerebro.mjs').Cerebro} cerebro
 */
export function registrarFerramentasEscrita(servidor, cerebro) {
  servidor.registerTool(
    'cerebro_registrar_decisao',
    {
      title: 'Registrar decisão',
      description:
        'Acrescenta uma entrada datada (hoje) em decisoes/registro.md no formato do kit: ' +
        'título, Decisão, Por quê, Alternativas consideradas e Responsável. ' +
        'Use quando a pessoa decidir algo relevante e quiser lembrar o porquê.',
      inputSchema: {
        titulo: z.string().min(1).describe('Título curto da decisão.'),
        decisao: z.string().min(1).describe('O que foi decidido.'),
        porque: z.string().min(1).describe('Raciocínio, restrições e o que faria mudar de ideia.'),
        alternativas: z.string().optional().describe('O que mais estava na mesa.'),
        responsavel: z.string().optional().describe('Quem responde por isso.'),
      },
    },
    protegido(async (args) => {
      const r = cerebro.registrarDecisao(args);
      return texto(`Decisão registrada em ${r.caminho}:\n\n${r.entrada}`);
    }),
  );

  servidor.registerTool(
    'cerebro_adicionar_fonte',
    {
      title: 'Adicionar fonte',
      description:
        'Grava material bruto (transcrição, anotação, exportação) em fontes/AAAA-MM-DD-<slug>.md. ' +
        'Nunca sobrescreve: se o nome já existir hoje, acrescenta -2, -3... ' +
        'Depois a pessoa roda /wiki no cérebro para transformar em páginas interligadas.',
      inputSchema: {
        nome: z.string().min(1).describe('Nome curto da fonte, vira o slug do arquivo.'),
        conteudo: z.string().min(1).describe('Conteúdo em Markdown ou texto puro.'),
      },
    },
    protegido(async (args) => {
      const r = cerebro.adicionarFonte(args);
      return texto(`Fonte gravada em ${r.caminho}.`);
    }),
  );

  servidor.registerTool(
    'cerebro_registrar_execucao',
    {
      title: 'Registrar execução de rotina',
      description:
        'Acrescenta uma linha no topo da tabela "Registro de execuções" de rotinas/registro.md ' +
        'com data e hora de agora. Avisa se o ID não estiver entre as rotinas ativas.',
      inputSchema: {
        id: z.string().min(1).describe('ID da rotina (coluna ID de "Rotinas ativas").'),
        resultado: z.string().min(1).describe('ok, falha, parcial... ou uma frase curta.'),
        saida: z.string().optional().describe('Caminho ou descrição do que foi produzido.'),
        observacao: z.string().optional().describe('Qualquer nota útil para a próxima execução.'),
      },
    },
    protegido(async (args) => {
      const r = cerebro.registrarExecucao(args);
      return texto(`Execução registrada em ${r.caminho}:\n${r.linha}${r.aviso ? `\n\nAviso: ${r.aviso}` : ''}`);
    }),
  );
}
