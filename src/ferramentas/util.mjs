// Utilidades compartilhadas pelas ferramentas MCP: formatação de resposta e
// tratamento uniforme de erros (ErroCerebro vira resposta com isError, não crash).

import { ErroCerebro } from '../cerebro.mjs';

/** Resposta MCP de texto simples. */
export function texto(conteudo) {
  return { content: [{ type: 'text', text: String(conteudo ?? '') }] };
}

/** Resposta MCP de erro (o cliente vê a mensagem, o servidor continua vivo). */
export function erro(mensagem) {
  return { content: [{ type: 'text', text: `Erro: ${mensagem}` }], isError: true };
}

/**
 * Envolve o handler de uma ferramenta: erros previsíveis viram `isError`,
 * erros inesperados também, mas com o nome da classe para facilitar o diagnóstico.
 */
export function protegido(fn) {
  return async (...args) => {
    try {
      return await fn(...args);
    } catch (e) {
      if (e instanceof ErroCerebro) return erro(e.message);
      return erro(`${e?.name ?? 'Erro'}: ${e?.message ?? e}`);
    }
  };
}

/** Monta uma tabela Markdown a partir de linhas-objeto (para saídas legíveis). */
export function tabelaMarkdown(colunas, linhas) {
  const cab = `| ${colunas.join(' | ')} |`;
  const sep = `|${colunas.map(() => '---').join('|')}|`;
  const corpo = linhas.map((l) => `| ${colunas.map((c) => String(l[c] ?? '').replace(/\|/g, '\\|')).join(' | ')} |`);
  return [cab, sep, ...corpo].join('\n');
}
