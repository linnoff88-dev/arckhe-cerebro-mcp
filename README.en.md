# cerebro-mcp

**🇧🇷 [Português](README.md) · 🇺🇸 [English](README.en.md) · 🇪🇸 [Español](README.es.md)**

**MCP** (Model Context Protocol) server that exposes your **second brain** — the Markdown folder created by the [astra-2cerebro](https://github.com/inematds/astra-2cerebro) kit — as tools for any MCP client: **Claude Code, Codex, Claude Desktop, n8n, bots**, and scripts.

One brain. Multiple clients. No copies.

## 📖 User guide

Complete guide (landing page + step-by-step instructions): **https://inematds.github.io/cerebro-mcp/guia/en/**

```
                     ┌──────────────┐
  Claude Code ──┐    │              │
  Codex ────────┼──► │  cerebro-mcp │ ──► ~/meu-cerebro/  (AGENTS.md, contexto/, wiki/, decisoes/ ...)
  Claude Desktop┤    │   (stdio or  │
  n8n / bot ────┘    │    HTTP)     │
                     └──────────────┘
```

## Why

The astra-2cerebro kit stores who you are, what you do, your priorities, decisions, projects, and a linked wiki — all in Markdown files. This works very well for the agent that opens the folder. But Codex in the terminal, Claude Desktop on your laptop, a workflow in n8n, and a bot on your phone don’t open the folder.

`cerebro-mcp` solves this: it starts an MCP server pointed at the folder, and each client gets access to `cerebro_contexto`, `cerebro_buscar`, `cerebro_ler`, `cerebro_registrar_decisao`, and the other tools. The brain remains just files; what changes is who can read them.

## Install in 1 minute

Requires Node.js 20 or higher.

```bash
git clone https://github.com/inematds/cerebro-mcp.git
cd cerebro-mcp
npm install
npm test                      # 42 tests against the fixture in test/fixture

# point to your brain and test over stdio
CEREBRO_DIR=~/meu-cerebro node scripts/teste-stdio.mjs ~/meu-cerebro
```

Register with **Claude Code** (one line):

```bash
claude mcp add cerebro -e CEREBRO_DIR=/caminho/do/cerebro -- node /caminho/cerebro-mcp/bin/cerebro-mcp.mjs
```

Codex, Claude Desktop, project `.mcp.json`, and HTTP mode: see **[INSTALAR.md](INSTALAR.md)**.

## How it works

```bash
cerebro-mcp [--dir <pasta>] [--escrita] [--http <porta>] [--host <ip>]
```

| Setting | How | Default |
|---|---|---|
| Brain folder | `--dir <pasta>` or `CEREBRO_DIR` | Current folder, if it has `AGENTS.md` or `CLAUDE.md`; otherwise, a clear error |
| Writing | `--escrita` or `CEREBRO_ESCRITA=1` | Disabled (read-only) |
| Transport | `--http <porta>` | stdio |
| HTTP address | `--host <ip>` | `127.0.0.1` |

Without `--http`, the server speaks MCP over **stdio** — this is what Claude Code, Codex, and Claude Desktop use. With `--http`, it starts a **Streamable HTTP** endpoint (`POST /mcp`, no session) for n8n, bots, and scripts on the same machine.

## Tools

| Tool | What it does | Writes? |
|---|---|---|
| `cerebro_contexto()` | `contexto/sobre-mim.md` + `sobre-o-trabalho.md` + `prioridades.md`, concatenated with paths | no |
| `cerebro_prioridades()` | Only `contexto/prioridades.md` | no |
| `cerebro_rotas()` | The "Route map" section of `AGENTS.md` (or `CLAUDE.md`) | no |
| `cerebro_buscar(consulta, limite?)` | Searches for terms in all `.md` files (title > path > wikilinks > frontmatter > body), with a snippet | no |
| `cerebro_ler(caminho)` | Contents of a file (or listing of a folder) inside the brain | no |
| `cerebro_wiki_indice()` | `wiki/index.md` | no |
| `cerebro_wiki_pagina(slug)` | Wiki page by slug, in `entidades/`, `conceitos/`, or `fontes/` | no |
| `cerebro_projetos()` | Each `projetos/<nome>/README.md` with the status line | no |
| `cerebro_conexoes()` | The table from `conexoes.md` | no |
| `cerebro_rotinas(limite?)` | Active routines and latest runs from `rotinas/registro.md` | no |
| `cerebro_registrar_decisao(titulo, decisao, porque, alternativas?, responsavel?)` | Appends a dated entry to `decisoes/registro.md` | **yes** |
| `cerebro_adicionar_fonte(nome, conteudo)` | Writes `fontes/AAAA-MM-DD-<slug>.md` without overwriting | **yes** |
| `cerebro_registrar_execucao(id, resultado, saida?, observacao?)` | Adds a new line at the top of the "Execution log" | **yes** |

The three write tools are only available when the server starts with `--escrita`. Details, parameters, and return examples: **[docs/ferramentas.md](docs/ferramentas.md)**.

In addition to tools, each `.md` file is exposed as a **resource** `cerebro://<caminho>` (for example, `cerebro://wiki/entidades/empresa-x.md`), for clients that prefer to "attach" a note.

## Conversation examples

Once the server is registered, the agent decides on its own when to call each tool.

> **You:** What are my priorities this quarter?
> **Agent:** *(calls `cerebro_prioridades`)* Three, according to `contexto/prioridades.md`: deliver Phase 2 of Project Alfa by the end of October, launch the new website, and reduce the weekly report from 4 hours to 1.

> **You:** Why did we decide to build the site with a static site generator?
> **Agent:** *(calls `cerebro_buscar("site estático")`, then `cerebro_ler("decisoes/registro.md")`)* On 2026-08-20, you recorded: zero cost and little maintenance; you’d change your mind if you needed a logged-in area.

> **You:** Record that we’ll accept Phase 2 with an October deadline.
> **Agent:** *(server with `--escrita`; calls `cerebro_registrar_decisao`)* Recorded in `decisoes/registro.md` with today’s date. Would you like me to note the alternatives considered?

> **You:** What did Company X ask for at the last meeting?
> **Agent:** *(calls `cerebro_wiki_pagina("empresa-x")`, follows the links to the source)* They approved the scope for Phase 2 and agreed to decide who will review the weekly reports.

## Security

- **Read-only by default.** Without `--escrita`, write tools aren’t even registered — the client can’t see them. And even when they’re registered, the core checks the flag again before writing.
- **Only within the folder.** Every path goes through `caminhoSeguro`: resolves, checks the prefix, follows symlinks, and checks again. `../`, absolute paths outside the folder, and links pointing outside it are rejected.
- **`.env`, `.git`, and `node_modules` are invisible**, even for reading.
- **HTTP binds to `127.0.0.1`** by default, without authentication. If you expose it on another interface, put an authenticated proxy in front — and remember that a brain contains personal data.
- **Nothing leaves the machine.** The server makes no external requests.

Details in **[docs/seguranca.md](docs/seguranca.md)**.

## Tests

```bash
npm test            # node --test: core, writing, and server (in-memory MCP client)
npm run teste:stdio # starts the actual binary and communicates over JSON-RPC via stdio
npm run teste:http  # starts --http on an available port and makes the calls an n8n client would
```

Actual stdio smoke test result (`node scripts/teste-stdio.mjs`, against `test/fixture`):

```
[servidor] [cerebro-mcp] pronto por stdio — cérebro em .../test/fixture (escrita desligada)
OK  initialize → servidor cerebro-mcp 1.0.0 (protocolo 2025-06-18)
OK  tools/list → 10 ferramentas: cerebro_contexto, cerebro_prioridades, cerebro_rotas, cerebro_buscar, cerebro_ler, cerebro_projetos, cerebro_conexoes, cerebro_rotinas, cerebro_wiki_indice, cerebro_wiki_pagina
OK  tools/call cerebro_buscar → 2 resultado(s) para "empresa x":
OK  tools/call cerebro_rotas → seção encontrada
OK  tools/call cerebro_ler ../../etc/passwd → isError (Erro: Acesso negado: "../../etc/passwd" está fora do cérebro.)
OK  resources/list → 27 recursos cerebro://
```

With `--escrita`, `tools/list` returns 13 tools (the 10 above plus `cerebro_registrar_decisao`, `cerebro_adicionar_fonte`, and `cerebro_registrar_execucao`). `npm test` covers: search (relevance, accents, wikilinks, ignored folders), reading with traversal/symlink/`.env` blocking, route and priority extraction, projects, connections, routines, wiki, resources, writing blocked without `--escrita` and working with it (on a temporary copy of the fixture).

## Documentation

- [INSTALAR.md](INSTALAR.md) — Claude Code, Codex, Claude Desktop, `.mcp.json`, HTTP, and instructions for an agent to install it on its own.
- [docs/arquitetura.md](docs/arquitetura.md) — how the code is organized.
- [docs/ferramentas.md](docs/ferramentas.md) — each tool with parameters, return value, and example.
- [docs/seguranca.md](docs/seguranca.md) — what is blocked and why.
- [docs/exemplos.md](docs/exemplos.md) — n8n, bot, and site calling the server in HTTP mode.
- [docs/faq.md](docs/faq.md) — frequently asked questions.

## Short FAQ

**Do I need the astra-2cerebro kit?** The server reads the structure created by the kit. It starts with any folder containing `AGENTS.md` or `CLAUDE.md`, but the context, wiki, and routines tools expect the kit’s files.

**Can I point two clients to the same brain?** Yes. Each client starts its own server process; they all read the same folder. Simultaneous writing is rare, and the three operations only append text.

**Does the server index anything?** No. Search scans the `.md` files on every call. It’s instant for brains with hundreds of notes; with thousands, it’s still acceptable.

**Does it work on Windows?** Yes, with Node 20+. Change the paths in the examples.

More in [docs/faq.md](docs/faq.md).

## Credits and license

Built for the **[astra-2cerebro](https://github.com/inematds/astra-2cerebro)** kit — the folder structure, decision format, routines, connections, and wiki come from there. Uses the official `@modelcontextprotocol/sdk`.

MIT — Copyright (c) 2026 inematds.
