// Monta o servidor MCP: instancia o núcleo, registra ferramentas e recursos.
// Não decide transporte — quem chama conecta stdio, HTTP ou memória (testes).

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { Cerebro } from './cerebro.mjs';
import { registrarFerramentasLeitura } from './ferramentas/leitura.mjs';
import { registrarFerramentasWiki } from './ferramentas/wiki.mjs';
import { registrarFerramentasEscrita } from './ferramentas/escrita.mjs';
import { registrarRecursos } from './recursos.mjs';

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/** Versão lida do arquivo VERSION (fonte única). */
export function versao() {
  try {
    return fs.readFileSync(path.join(raiz, 'VERSION'), 'utf8').trim();
  } catch {
    return '0.0.0';
  }
}

/** Nomes das ferramentas, para documentação e testes. */
export const FERRAMENTAS_LEITURA = [
  'cerebro_contexto', 'cerebro_prioridades', 'cerebro_rotas', 'cerebro_buscar', 'cerebro_ler',
  'cerebro_wiki_indice', 'cerebro_wiki_pagina', 'cerebro_projetos', 'cerebro_conexoes', 'cerebro_rotinas',
];
export const FERRAMENTAS_ESCRITA = ['cerebro_registrar_decisao', 'cerebro_adicionar_fonte', 'cerebro_registrar_execucao'];

/**
 * Cria o servidor MCP para um cérebro.
 * @param {{dir: string, escrita?: boolean}} opcoes
 * @returns {{servidor: McpServer, cerebro: Cerebro}}
 */
export function criarServidor({ dir, escrita = false }) {
  const cerebro = new Cerebro(dir, { escrita });
  const servidor = new McpServer(
    { name: 'cerebro-mcp', version: versao() },
    {
      instructions:
        `Este servidor expõe o segundo cérebro em ${cerebro.dir}. ` +
        'Comece por cerebro_contexto e cerebro_rotas para saber onde as coisas vivem; ' +
        'use cerebro_buscar e cerebro_ler para achar e abrir notas. ' +
        (escrita
          ? 'A escrita está ligada: registre decisões, fontes e execuções de rotina quando a pessoa pedir.'
          : 'A escrita está desligada (somente leitura).'),
    },
  );

  registrarFerramentasLeitura(servidor, cerebro);
  registrarFerramentasWiki(servidor, cerebro);
  if (escrita) registrarFerramentasEscrita(servidor, cerebro);
  registrarRecursos(servidor, cerebro);

  return { servidor, cerebro };
}
