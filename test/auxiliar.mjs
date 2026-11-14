// Auxiliares dos testes: caminho da fixture e cópia temporária para testes de escrita.

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const FIXTURE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), 'fixture');
export const PASTA_TMP = path.resolve(path.dirname(fileURLToPath(import.meta.url)), 'tmp');

/** Copia a fixture para test/tmp/<nome-aleatório> e devolve o caminho. */
export function copiarFixture() {
  fs.mkdirSync(PASTA_TMP, { recursive: true });
  const destino = fs.mkdtempSync(path.join(PASTA_TMP, 'cerebro-'));
  fs.cpSync(FIXTURE, destino, { recursive: true });
  return destino;
}

/** Remove a cópia temporária (ignora se já não existir). */
export function limpar(pasta) {
  fs.rmSync(pasta, { recursive: true, force: true });
}

export { os };
