# Arquitetura

O projeto é pequeno de propósito: um núcleo sem dependências, uma camada fina de ferramentas MCP e dois transportes.

```
bin/cerebro-mcp.mjs        CLI: lê argumentos e variáveis, escolhe stdio ou HTTP
src/servidor.mjs           cria o McpServer e registra ferramentas + recursos
src/cerebro.mjs            núcleo: localizar, ler, buscar, extrair, escrever (só Node.js)
src/ferramentas/util.mjs   resposta de texto, resposta de erro, wrapper `protegido`
src/ferramentas/leitura.mjs  contexto, prioridades, rotas, buscar, ler, projetos, conexoes, rotinas
src/ferramentas/wiki.mjs     wiki_indice, wiki_pagina
src/ferramentas/escrita.mjs  registrar_decisao, adicionar_fonte, registrar_execucao
src/recursos.mjs           recursos cerebro://<caminho>
src/http.mjs               transporte Streamable HTTP em 127.0.0.1 (stateless)
scripts/teste-stdio.mjs    fumaça: processo real + JSON-RPC cru por stdio
scripts/teste-http.mjs     fumaça: --http em porta livre + fetch
test/*.test.mjs            node --test contra test/fixture
test/fixture/              um cérebro pequeno no formato do kit
```

## Fluxo de uma chamada

1. O cliente MCP (Claude Code, Codex...) sobe `bin/cerebro-mcp.mjs` como processo filho e conversa por stdio em JSON-RPC.
2. `resolverDir` decide a pasta: `--dir` > `CEREBRO_DIR` > pasta atual (se tiver `AGENTS.md`/`CLAUDE.md`). Sem cérebro, erro claro no stderr e saída 1.
3. `criarServidor` instancia `Cerebro(dir, {escrita})` e registra as ferramentas de leitura e wiki sempre; as de escrita só se `escrita` for verdadeiro; e os recursos.
4. Cada ferramenta é um handler embrulhado em `protegido`: `ErroCerebro` (caminho proibido, arquivo ausente, escrita desligada) vira uma resposta com `isError: true`. O processo nunca cai por causa de uma chamada ruim.
5. O handler chama um método do `Cerebro`, que lê o disco na hora (não há índice nem cache) e devolve texto Markdown pronto para o modelo ler.

## O núcleo (`src/cerebro.mjs`)

- **Sem estado.** Cada método lê do disco. Editar o cérebro em outro programa é refletido na chamada seguinte.
- **Utilidades puras** exportadas e testáveis: `normalizar`, `slugificar`, `dataLocal`, `separarFrontmatter`, `extrairTitulo`, `extrairWikilinks`, `extrairSecao`, `extrairTabelas`, `celula`.
- **`caminhoSeguro`** é a única porta de entrada para o disco. Ver [seguranca.md](seguranca.md).
- **Busca**: para cada `.md` fora das pastas ignoradas, normaliza título, caminho, wikilinks, frontmatter e corpo (minúsculas, sem acento) e pontua cada termo: título 10, caminho 6, wikilinks 5, frontmatter 3, corpo 1 por ocorrência (até 5). Bônus: todos os termos presentes (+3), frase inteira no título/corpo (+4), título igual à consulta (+15), slug igual à consulta (+12). O trecho é a primeira linha do corpo que contém um termo.
- **Escrita** acrescenta, nunca sobrescreve: decisão vai ao fim de `decisoes/registro.md`; fonte recebe sufixo `-2`, `-3` se o nome já existir (`flag: 'wx'` no `writeFileSync`); execução entra logo abaixo do separador da tabela ("mais recente no topo").

## Por que texto e não JSON estruturado

As ferramentas devolvem Markdown com o caminho do arquivo em comentário (`<!-- contexto/sobre-mim.md -->`). É o que um modelo lê melhor e o que permite citar a fonte. Quem precisa de dados estruturados (n8n, scripts) usa o núcleo direto (`import { Cerebro } from 'cerebro-mcp/cerebro'`) ou parseia as tabelas Markdown.

## Transportes

- **stdio** (`StdioServerTransport`): padrão. Regra de ouro: nada além do protocolo vai para o stdout — todo log usa `console.error`.
- **HTTP** (`StreamableHTTPServerTransport`, `src/http.mjs`): modo *stateless* (`sessionIdGenerator: undefined`, `enableJsonResponse: true`). Cada `POST /mcp` cria servidor + transporte novos, responde JSON simples e encerra. Não há sessão, GET de stream nem DELETE. Suficiente para `tools/list` e `tools/call`; `GET /saude` serve para monitoramento.

## Testes

- `test/nucleo.test.mjs`: utilidades, `resolverDir`, leitura e bloqueios, extrações, busca.
- `test/escrita.test.mjs`: as três operações de escrita numa cópia temporária da fixture, com e sem `escrita`.
- `test/servidor.test.mjs`: servidor de verdade ligado a um `Client` do SDK por `InMemoryTransport` — lista de ferramentas nos dois modos, chamadas, `isError`, recursos e validação de esquema.
- `scripts/teste-stdio.mjs` e `scripts/teste-http.mjs`: fumaça com processo real e HTTP real.

## Versão

`VERSION` é a fonte única; `src/servidor.mjs` lê o arquivo para preencher `serverInfo.version`. `package.json` e `CHANGELOG.md` acompanham.
