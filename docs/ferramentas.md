# Ferramentas

Todas devolvem texto (Markdown) em `content[0].text`. Erros previsíveis voltam com `isError: true` e a mensagem começa com `Erro:`. Os caminhos citados são relativos à raiz do cérebro.

As dez primeiras estão sempre disponíveis. As três últimas só existem quando o servidor sobe com `--escrita` (ou `CEREBRO_ESCRITA=1`).

---

## `cerebro_contexto`

Quem é a pessoa, o que faz e quais são as prioridades.

- **Parâmetros:** nenhum.
- **Lê:** `contexto/sobre-mim.md`, `contexto/sobre-o-trabalho.md`, `contexto/prioridades.md`.
- **Retorno:** os três arquivos concatenados, cada um precedido de `<!-- caminho -->` e separados por `---`. Arquivo ausente aparece como `(ausente)`.

```
<!-- contexto/sobre-mim.md -->
---
tipo: entidade
atualizado: 2026-09-01
---
# Sobre mim
Sou consultor e trabalho no [[projeto-alfa]] com a [[empresa-x]].

---

<!-- contexto/sobre-o-trabalho.md -->
...
```

Quando usar: no início de qualquer conversa que dependa de contexto pessoal.

---

## `cerebro_prioridades`

Só as prioridades do trimestre.

- **Parâmetros:** nenhum.
- **Lê:** `contexto/prioridades.md`.
- **Retorno:** o arquivo inteiro, ou `(contexto/prioridades.md ausente: ...)`.

---

## `cerebro_rotas`

A seção "Mapa de rotas" do manual do agente: "se precisar de X, olhe em Y".

- **Parâmetros:** nenhum.
- **Lê:** `AGENTS.md`; se não existir, `CLAUDE.md`.
- **Retorno:** a seção `## Mapa de rotas...` até o próximo título de mesmo nível.

```
## Mapa de rotas: onde as coisas vivem

Se precisar de... → olhe em...

- Quem sou, o que faço, para quem → `contexto/sobre-mim.md`, `contexto/sobre-o-trabalho.md`
- Prioridades do trimestre → `contexto/prioridades.md` (fonte canônica; não inventar prioridades)
...
```

---

## `cerebro_buscar`

Busca por termos em todos os `.md` do cérebro.

| Parâmetro | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `consulta` | string | sim | Termos separados por espaço. Acentos e maiúsculas são ignorados. Termos de 1 letra são descartados. |
| `limite` | inteiro 1–50 | não | Máximo de resultados (padrão 10). |

- **Ignora:** `.git`, `node_modules`, `.claude`, `.agents`, `.codex`, `apps`.
- **Relevância:** título > caminho > wikilinks > frontmatter > corpo; bônus quando a consulta é exatamente o título ou o slug do arquivo.
- **Retorno:** lista numerada com título, caminho, tipo/atualizado (se houver frontmatter) e um trecho.

Exemplo — `{"consulta": "empresa x", "limite": 3}`:

```
3 resultado(s) para "empresa x":

1. **Empresa X** — `wiki/entidades/empresa-x.md` (tipo: entidade, atualizado: 2026-08-20)
   Cliente principal. Ver [[projeto-alfa]] e [[segundo-cerebro]].

2. **Reunião com a Empresa X (2026-09-01)** — `wiki/fontes/2026-09-01-reuniao-empresa-x.md` (tipo: fonte, atualizado: 2026-09-02)
   - A [[empresa-x]] aprovou o escopo da fase 2.

3. **Transcrição: reunião com a Empresa X, 2026-09-01** — `fontes/2026-09-01-reuniao-empresa-x.md`
   Material bruto. Não editar.
```

Sem resultados: `Nada encontrado para "..."`.

---

## `cerebro_ler`

Conteúdo de um arquivo, ou listagem de uma pasta.

| Parâmetro | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `caminho` | string | sim | Caminho relativo à raiz do cérebro, ex. `decisoes/registro.md`. |

- **Bloqueia:** qualquer coisa fora do cérebro (`../`, absolutos de fora, symlinks para fora), `.git`, `node_modules`, arquivos `.env*`.
- **Retorno:** `<!-- caminho -->` seguido do conteúdo. Para pasta: `Pasta wiki/:` e a lista de itens.

Erros: `Erro: Acesso negado: "../../etc/passwd" está fora do cérebro.`, `Erro: Acesso negado a ".env": .env é protegido.`, `Erro: Arquivo não encontrado: x.md`.

---

## `cerebro_wiki_indice`

- **Parâmetros:** nenhum.
- **Lê:** `wiki/index.md`.
- **Retorno:** o índice inteiro. Cada `[[slug]]` pode ser aberto com `cerebro_wiki_pagina`.

---

## `cerebro_wiki_pagina`

| Parâmetro | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `slug` | string | sim | O texto dentro de `[[...]]`, ex. `empresa-x`. Aceita título com acento (`Segundo cérebro`). |

- **Procura em:** `wiki/entidades/`, `wiki/conceitos/`, `wiki/fontes/`, raiz de `wiki/`. Primeiro nome exato, depois nome sem acento/caixa, depois título igual.
- **Retorno:** `<!-- caminho -->`, o conteúdo com frontmatter, e um comentário com os links de saída.

```
<!-- wiki/entidades/empresa-x.md -->
---
tipo: entidade
atualizado: 2026-08-20
---
# Empresa X
Cliente principal. Ver [[projeto-alfa]] e [[segundo-cerebro]].

<!-- links de saída: [[projeto-alfa]] [[segundo-cerebro]] -->
```

---

## `cerebro_projetos`

- **Parâmetros:** nenhum.
- **Lê:** cada `projetos/<nome>/README.md` (o `projetos/README.md` da raiz é o índice e não conta).
- **Estado:** a primeira linha que começa com `Estado:`; se não houver, a primeira linha que não é título.

```
2 projeto(s):

- **Projeto Alfa** (`projetos/projeto-alfa/README.md`)
  Estado: em andamento. Cliente: [[empresa-x]]. Próximo passo: fase 2.
- **Site novo** (`projetos/site-novo/README.md`) — atualizado 2026-08-28
  Estado: planejamento. Próximo passo: escolher o modelo da página de serviços.
```

---

## `cerebro_conexoes`

- **Parâmetros:** nenhum.
- **Lê:** a primeira tabela de `conexoes.md`.
- **Retorno:** a tabela Markdown como está no arquivo (`# | Domínio | Ferramenta | Mecanismo | Autenticação | Última leitura OK`).

---

## `cerebro_rotinas`

| Parâmetro | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `limite` | inteiro 1–100 | não | Quantas execuções mostrar (padrão 10). |

- **Lê:** as seções "Rotinas ativas" e "Registro de execuções" de `rotinas/registro.md`.
- **Retorno:** as duas tabelas; as execuções mais recentes primeiro (é a ordem do arquivo).

---

## `cerebro_registrar_decisao` (escrita)

Acrescenta uma entrada datada em `decisoes/registro.md`.

| Parâmetro | Tipo | Obrigatório |
|---|---|---|
| `titulo` | string | sim |
| `decisao` | string | sim |
| `porque` | string | sim |
| `alternativas` | string | não (padrão "não registradas.") |
| `responsavel` | string | não (padrão "não informado.") |

Escreve, ao fim do arquivo, exatamente no formato do kit:

```
## 2026-09-07: Usar MCP

**Decisão:** Expor o cérebro por MCP.

**Por quê:** Um cérebro, vários clientes.

**Alternativas consideradas:** Copiar arquivos.

**Responsável:** eu
```

A data é a **local** da máquina (não UTC). Retorno: `Decisão registrada em decisoes/registro.md:` seguido da entrada.

---

## `cerebro_adicionar_fonte` (escrita)

Grava material bruto em `fontes/`.

| Parâmetro | Tipo | Obrigatório |
|---|---|---|
| `nome` | string | sim — vira o slug do arquivo |
| `conteudo` | string | sim — Markdown ou texto |

- Arquivo: `fontes/AAAA-MM-DD-<slug>.md`. Se já existir, `-2`, `-3`...
- Se o conteúdo não começar com `#`, o servidor põe `# <nome>` como título.
- Retorno: `Fonte gravada em fontes/2026-09-07-reuniao-de-kickoff.md.`

---

## `cerebro_registrar_execucao` (escrita)

Nova linha no **topo** da tabela "Registro de execuções" de `rotinas/registro.md`.

| Parâmetro | Tipo | Obrigatório |
|---|---|---|
| `id` | string | sim — coluna ID de "Rotinas ativas" |
| `resultado` | string | sim — `ok`, `falha`, `parcial` ou frase curta |
| `saida` | string | não |
| `observacao` | string | não |

- Data e hora locais (`AAAA-MM-DD HH:MM`). Barras verticais no texto são escapadas para não quebrar a tabela.
- Se o `id` não estiver em "Rotinas ativas", grava mesmo assim e devolve um `Aviso:`.
- Retorno: `Execução registrada em rotinas/registro.md:` e a linha gravada.

---

## Recursos `cerebro://`

Além das ferramentas, o servidor publica cada `.md` como recurso MCP:

- `resources/list` → um recurso por arquivo, `uri: cerebro://<caminho>`, `mimeType: text/markdown`.
- `resources/read` com `uri: cerebro://wiki/entidades/empresa-x.md` → o conteúdo.

Passa pelo mesmo `caminhoSeguro` das ferramentas: `cerebro://../../etc/passwd` é recusado.
