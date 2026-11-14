# Changelog

Formato: versão, data, o que mudou. Versionamento semântico `vX.XX.YY`.

## 1.0.0 — 2026-09-07

Primeira versão.

- Servidor MCP por **stdio** (padrão) e **HTTP** (`--http <porta>`, Streamable HTTP sem sessão em `127.0.0.1`).
- Dez ferramentas de leitura: `cerebro_contexto`, `cerebro_prioridades`, `cerebro_rotas`, `cerebro_buscar`, `cerebro_ler`, `cerebro_wiki_indice`, `cerebro_wiki_pagina`, `cerebro_projetos`, `cerebro_conexoes`, `cerebro_rotinas`.
- Três ferramentas de escrita, só com `--escrita`/`CEREBRO_ESCRITA=1`: `cerebro_registrar_decisao`, `cerebro_adicionar_fonte`, `cerebro_registrar_execucao`.
- Recursos `cerebro://<caminho>` para cada `.md`.
- Localização do cérebro por `--dir`, `CEREBRO_DIR` ou pasta atual (com `AGENTS.md`/`CLAUDE.md`).
- Bloqueio de caminhos fora da pasta (inclusive symlinks), `.git`, `node_modules` e `.env*`.
- 42 testes (`node --test`) contra `test/fixture`, mais fumaça por stdio e HTTP em `scripts/`.
- Documentação: README, INSTALAR (Claude Code, Codex, Claude Desktop, npx, HTTP, instruções para agente), docs de arquitetura, ferramentas, segurança, exemplos e FAQ.
