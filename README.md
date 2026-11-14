# cerebro-mcp

**ðŸ‡§ðŸ‡· [PortuguÃªs](README.md) Â· ðŸ‡ºðŸ‡¸ [English](README.en.md) Â· ðŸ‡ªðŸ‡¸ [EspaÃ±ol](README.es.md)**

Servidor **MCP** (Model Context Protocol) que expÃµe o seu **segundo cÃ©rebro** â€” a pasta de Markdown criada pelo kit [astra-2cerebro](https://github.com/inematds/astra-2cerebro) â€” como ferramentas para qualquer cliente MCP: **Claude Code, Codex, Claude Desktop, n8n, bots** e scripts.

Um cÃ©rebro. VÃ¡rios clientes. Nenhuma cÃ³pia.

## ðŸ“– Guia de uso

Guia completo (landing + passo a passo): **https://inematds.github.io/cerebro-mcp/guia/**

```
                     â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
  Claude Code â”€â”€â”    â”‚              â”‚
  Codex â”€â”€â”€â”€â”€â”€â”€â”€â”¼â”€â”€â–º â”‚  cerebro-mcp â”‚ â”€â”€â–º ~/meu-cerebro/  (AGENTS.md, contexto/, wiki/, decisoes/ ...)
  Claude Desktopâ”¤    â”‚   (stdio ou  â”‚
  n8n / bot â”€â”€â”€â”€â”˜    â”‚    HTTP)     â”‚
                     â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
```

## Por quÃª

O kit astra-2cerebro guarda quem vocÃª Ã©, o que faz, suas prioridades, decisÃµes, projetos e uma wiki interligada â€” tudo em arquivos Markdown. Isso funciona muito bem para o agente que abre a pasta. Mas o Codex no terminal, o Claude Desktop no notebook, um fluxo no n8n e um bot no celular nÃ£o abrem a pasta.

O `cerebro-mcp` resolve isso: sobe um servidor MCP apontado para a pasta e cada cliente passa a ter `cerebro_contexto`, `cerebro_buscar`, `cerebro_ler`, `cerebro_registrar_decisao` e as demais ferramentas. O cÃ©rebro continua sendo sÃ³ arquivos; quem muda Ã© quem consegue lÃª-los.

## InstalaÃ§Ã£o em 1 minuto

Precisa de Node.js 20 ou superior.

```bash
git clone https://github.com/inematds/cerebro-mcp.git
cd cerebro-mcp
npm install
npm test                      # 42 testes contra a fixture em test/fixture

# aponte para o seu cÃ©rebro e teste por stdio
CEREBRO_DIR=~/meu-cerebro node scripts/teste-stdio.mjs ~/meu-cerebro
```

Registrar no **Claude Code** (uma linha):

```bash
claude mcp add cerebro -e CEREBRO_DIR=/caminho/do/cerebro -- node /caminho/cerebro-mcp/bin/cerebro-mcp.mjs
```

Codex, Claude Desktop, `.mcp.json` do projeto e modo HTTP: veja **[INSTALAR.md](INSTALAR.md)**.

## Como funciona

```bash
cerebro-mcp [--dir <pasta>] [--escrita] [--http <porta>] [--host <ip>]
```

| ConfiguraÃ§Ã£o | Como | PadrÃ£o |
|---|---|---|
| Pasta do cÃ©rebro | `--dir <pasta>` ou `CEREBRO_DIR` | pasta atual, se tiver `AGENTS.md` ou `CLAUDE.md`; senÃ£o erro claro |
| Escrita | `--escrita` ou `CEREBRO_ESCRITA=1` | desligada (somente leitura) |
| Transporte | `--http <porta>` | stdio |
| EndereÃ§o HTTP | `--host <ip>` | `127.0.0.1` |

Sem `--http` o servidor fala MCP por **stdio** â€” Ã© o que Claude Code, Codex e Claude Desktop usam. Com `--http` ele sobe um endpoint **Streamable HTTP** (`POST /mcp`, sem sessÃ£o) para n8n, bots e scripts na mesma mÃ¡quina.

## Ferramentas

| Ferramenta | O que faz | Escrita? |
|---|---|---|
| `cerebro_contexto()` | `contexto/sobre-mim.md` + `sobre-o-trabalho.md` + `prioridades.md`, concatenados com os caminhos | nÃ£o |
| `cerebro_prioridades()` | SÃ³ `contexto/prioridades.md` | nÃ£o |
| `cerebro_rotas()` | A seÃ§Ã£o "Mapa de rotas" do `AGENTS.md` (ou `CLAUDE.md`) | nÃ£o |
| `cerebro_buscar(consulta, limite?)` | Busca por termos em todos os `.md` (tÃ­tulo > caminho > wikilinks > frontmatter > corpo), com trecho | nÃ£o |
| `cerebro_ler(caminho)` | ConteÃºdo de um arquivo (ou listagem de uma pasta) dentro do cÃ©rebro | nÃ£o |
| `cerebro_wiki_indice()` | `wiki/index.md` | nÃ£o |
| `cerebro_wiki_pagina(slug)` | PÃ¡gina da wiki pelo slug, em `entidades/`, `conceitos/` ou `fontes/` | nÃ£o |
| `cerebro_projetos()` | Cada `projetos/<nome>/README.md` com a linha de estado | nÃ£o |
| `cerebro_conexoes()` | A tabela de `conexoes.md` | nÃ£o |
| `cerebro_rotinas(limite?)` | Rotinas ativas e Ãºltimas execuÃ§Ãµes de `rotinas/registro.md` | nÃ£o |
| `cerebro_registrar_decisao(titulo, decisao, porque, alternativas?, responsavel?)` | Acrescenta entrada datada em `decisoes/registro.md` | **sim** |
| `cerebro_adicionar_fonte(nome, conteudo)` | Grava `fontes/AAAA-MM-DD-<slug>.md` sem sobrescrever | **sim** |
| `cerebro_registrar_execucao(id, resultado, saida?, observacao?)` | Nova linha no topo do "Registro de execuÃ§Ãµes" | **sim** |

As trÃªs de escrita sÃ³ aparecem quando o servidor sobe com `--escrita`. Detalhes, parÃ¢metros e exemplos de retorno: **[docs/ferramentas.md](docs/ferramentas.md)**.

AlÃ©m das ferramentas, cada `.md` Ã© exposto como **recurso** `cerebro://<caminho>` (por exemplo `cerebro://wiki/entidades/empresa-x.md`), para clientes que preferem "anexar" uma nota.

## Exemplos de conversa

Com o servidor registrado, o agente decide sozinho quando chamar cada ferramenta.

> **VocÃª:** Quais sÃ£o as minhas prioridades deste trimestre?
> **Agente:** *(chama `cerebro_prioridades`)* TrÃªs, segundo `contexto/prioridades.md`: entregar a fase 2 do Projeto Alfa atÃ© o fim de outubro, lanÃ§ar o site novo e reduzir o relatÃ³rio semanal de 4 horas para 1.

> **VocÃª:** Por que decidimos fazer o site em gerador estÃ¡tico?
> **Agente:** *(chama `cerebro_buscar("site estÃ¡tico")`, depois `cerebro_ler("decisoes/registro.md")`)* Em 2026-08-20 vocÃª registrou: custo zero e pouca manutenÃ§Ã£o; mudaria de ideia se precisasse de Ã¡rea logada.

> **VocÃª:** Registra que vamos aceitar a fase 2 com prazo em outubro.
> **Agente:** *(servidor com `--escrita`; chama `cerebro_registrar_decisao`)* Registrado em `decisoes/registro.md` com a data de hoje. Quer que eu anote as alternativas consideradas?

> **VocÃª:** O que a Empresa X pediu na Ãºltima reuniÃ£o?
> **Agente:** *(chama `cerebro_wiki_pagina("empresa-x")`, segue os links para a fonte)* Aprovou o escopo da fase 2 e ficou de definir quem valida os relatÃ³rios semanais.

## SeguranÃ§a

- **Leitura por padrÃ£o.** Sem `--escrita`, as ferramentas de escrita nem sÃ£o registradas â€” o cliente nÃ£o as vÃª. E mesmo com elas registradas, o nÃºcleo confere a flag de novo antes de gravar.
- **SÃ³ dentro da pasta.** Todo caminho passa por `caminhoSeguro`: resolve, confere o prefixo, segue symlinks e confere de novo. `../`, caminhos absolutos de fora e links apontando para fora sÃ£o recusados.
- **`.env`, `.git` e `node_modules` sÃ£o invisÃ­veis**, mesmo para leitura.
- **HTTP sÃ³ em `127.0.0.1`** por padrÃ£o, sem autenticaÃ§Ã£o. Se expor em outra interface, coloque um proxy com autenticaÃ§Ã£o na frente â€” e lembre que um cÃ©rebro contÃ©m dados pessoais.
- **Nada sai da mÃ¡quina.** O servidor nÃ£o faz requisiÃ§Ãµes externas.

Detalhes em **[docs/seguranca.md](docs/seguranca.md)**.

## Testes

```bash
npm test            # node --test: nÃºcleo, escrita e servidor (cliente MCP em memÃ³ria)
npm run teste:stdio # sobe o binÃ¡rio de verdade e conversa em JSON-RPC por stdio
npm run teste:http  # sobe --http em porta livre e faz as chamadas que um n8n faria
```

Resultado real da fumaÃ§a por stdio (`node scripts/teste-stdio.mjs`, contra `test/fixture`):

```
[servidor] [cerebro-mcp] pronto por stdio â€” cÃ©rebro em .../test/fixture (escrita desligada)
OK  initialize â†’ servidor cerebro-mcp 1.0.0 (protocolo 2025-06-18)
OK  tools/list â†’ 10 ferramentas: cerebro_contexto, cerebro_prioridades, cerebro_rotas, cerebro_buscar, cerebro_ler, cerebro_projetos, cerebro_conexoes, cerebro_rotinas, cerebro_wiki_indice, cerebro_wiki_pagina
OK  tools/call cerebro_buscar â†’ 2 resultado(s) para "empresa x":
OK  tools/call cerebro_rotas â†’ seÃ§Ã£o encontrada
OK  tools/call cerebro_ler ../../etc/passwd â†’ isError (Erro: Acesso negado: "../../etc/passwd" estÃ¡ fora do cÃ©rebro.)
OK  resources/list â†’ 27 recursos cerebro://
```

Com `--escrita`, o `tools/list` devolve 13 ferramentas (as 10 acima mais `cerebro_registrar_decisao`, `cerebro_adicionar_fonte` e `cerebro_registrar_execucao`). O `npm test` cobre: busca (relevÃ¢ncia, acentos, wikilinks, pastas ignoradas), leitura com bloqueio de traversal/symlink/`.env`, extraÃ§Ã£o de rotas e prioridades, projetos, conexÃµes, rotinas, wiki, recursos, escrita bloqueada sem `--escrita` e funcionando com ela (em cÃ³pia temporÃ¡ria da fixture).

## DocumentaÃ§Ã£o

- [INSTALAR.md](INSTALAR.md) â€” Claude Code, Codex, Claude Desktop, `.mcp.json`, HTTP, e instruÃ§Ãµes para um agente instalar sozinho.
- [docs/arquitetura.md](docs/arquitetura.md) â€” como o cÃ³digo estÃ¡ organizado.
- [docs/ferramentas.md](docs/ferramentas.md) â€” cada ferramenta com parÃ¢metros, retorno e exemplo.
- [docs/seguranca.md](docs/seguranca.md) â€” o que Ã© bloqueado e por quÃª.
- [docs/exemplos.md](docs/exemplos.md) â€” n8n, bot e site chamando o servidor em modo HTTP.
- [docs/faq.md](docs/faq.md) â€” perguntas frequentes.

## FAQ curta

**Preciso do kit astra-2cerebro?** O servidor lÃª a estrutura que o kit cria. Qualquer pasta com `AGENTS.md` ou `CLAUDE.md` sobe, mas as ferramentas de contexto, wiki e rotinas esperam os arquivos do kit.

**Posso apontar dois clientes para o mesmo cÃ©rebro?** Sim. Cada cliente sobe o prÃ³prio processo do servidor; todos leem a mesma pasta. Escrita simultÃ¢nea Ã© rara e as trÃªs operaÃ§Ãµes sÃ³ acrescentam texto.

**O servidor indexa em algum lugar?** NÃ£o. A busca varre os `.md` a cada chamada. Para cÃ©rebros com centenas de notas Ã© instantÃ¢neo; para milhares ainda Ã© aceitÃ¡vel.

**Funciona no Windows?** Sim, com Node 20+. Nos exemplos, troque os caminhos.

Mais em [docs/faq.md](docs/faq.md).

## CrÃ©ditos e licenÃ§a

ConstruÃ­do para o kit **[astra-2cerebro](https://github.com/inematds/astra-2cerebro)** â€” a estrutura de pastas, o formato das decisÃµes, rotinas, conexÃµes e wiki vÃªm de lÃ¡. Usa o SDK oficial `@modelcontextprotocol/sdk`.

MIT â€” Copyright (c) 2026 inematds.

---

Projeto adaptado da comunidade INEMA TDS - Marca Arckhe