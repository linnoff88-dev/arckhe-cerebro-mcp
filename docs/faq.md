# Perguntas frequentes

**O que é MCP?**
Model Context Protocol: um padrão aberto para um modelo de IA chamar ferramentas e ler recursos de um programa externo. Claude Code, Codex, Claude Desktop e vários outros clientes falam MCP. O `cerebro-mcp` é um "servidor" desse protocolo: o cliente sobe o processo, pergunta quais ferramentas existem e as chama quando precisa.

**Preciso do kit astra-2cerebro?**
O servidor lê a estrutura que o kit cria (`contexto/`, `wiki/`, `decisoes/registro.md`, `rotinas/registro.md`, `conexoes.md`...). Qualquer pasta com `AGENTS.md` ou `CLAUDE.md` sobe, e `cerebro_buscar`/`cerebro_ler` funcionam em qualquer Markdown, mas as ferramentas específicas devolvem "(ausente)" para arquivos que não existirem.

**O cérebro precisa estar na mesma máquina?**
Sim. O servidor lê o disco local. Se o cérebro vive num repositório git, clone-o na máquina onde o cliente roda.

**Posso usar dois clientes ao mesmo tempo?**
Sim. Cada cliente sobe o próprio processo do servidor e todos leem a mesma pasta. Não há cache: uma nota alterada por um cliente aparece para o outro na chamada seguinte. Escritas simultâneas no mesmo arquivo são improváveis (cada operação é um acréscimo rápido), mas se você tiver muitos agentes escrevendo, ligue `--escrita` em um só.

**Como sei se a escrita está ligada?**
No `tools/list`: com escrita são 13 ferramentas, sem escrita 10. O servidor também escreve `(escrita ligada)` ou `(escrita desligada)` no stderr ao subir, e as instruções que ele envia ao cliente dizem o modo.

**A escrita pode apagar algo?**
Não. As três operações só acrescentam: uma entrada ao fim de `decisoes/registro.md`, um arquivo novo em `fontes/` (com sufixo se o nome já existir), uma linha nova numa tabela.

**Por que a busca não achou uma skill em `.claude/skills`?**
Porque `.claude`, `.agents`, `.codex`, `apps`, `.git` e `node_modules` ficam fora da busca de propósito — são código e ferramentas, não conhecimento. `cerebro_ler(".claude/skills/x/SKILL.md")` continua funcionando se você pedir o caminho.

**A busca é semântica?**
Não. É busca por termos, sem acento e sem caixa, com pesos por onde o termo aparece (título, caminho, wikilinks, frontmatter, corpo). É rápida, previsível e não precisa de índice nem de modelo. Para "perguntas abertas", o padrão que funciona é: o agente chama `cerebro_buscar` com 2 ou 3 termos, lê os melhores com `cerebro_ler` e responde.

**Quantas notas aguenta?**
Cada busca lê todos os `.md`. Com algumas centenas de notas é instantâneo; com alguns milhares leva dezenas de milissegundos. Se um dia for gargalo, o lugar para um índice é `Cerebro.buscar` — o resto do servidor não muda.

**Funciona no Windows?**
Sim, com Node 20+. Use caminhos do Windows nas configurações (`C:\\Users\\voce\\meu-cerebro`) e `node` no PATH. A verificação de caminho usa `path.sep` da plataforma.

**O servidor sobe mas o cliente diz "sem ferramentas".**
Quase sempre é a pasta: veja o stderr do cliente (no Claude Code, `claude mcp get cerebro` e os logs). Se aparecer `Nenhum cérebro encontrado` ou `não parece um cérebro`, corrija `CEREBRO_DIR`/`--dir`.

**Por que o modo HTTP responde 406?**
Falta o cabeçalho `Accept: application/json, text/event-stream`. O SDK exige os dois tipos. Veja [exemplos.md](exemplos.md).

**Posso expor o HTTP na rede?**
Só com um proxy autenticado na frente. O servidor não tem autenticação, e um cérebro tem dados pessoais. Ver [seguranca.md](seguranca.md).

**Como atualizo?**
`cd /caminho/cerebro-mcp && git pull && npm install && npm test`. Os clientes apontam para o mesmo `bin/cerebro-mcp.mjs`, então não precisa reconfigurar nada.

**Onde vejo o que mudou entre versões?**
[CHANGELOG.md](../CHANGELOG.md). A versão que o servidor anuncia ao cliente vem do arquivo `VERSION`.

**Posso usar o núcleo sem MCP?**
Sim: `import { Cerebro } from '/caminho/cerebro-mcp/src/cerebro.mjs'`, depois `new Cerebro('/caminho/do/cerebro').buscar('termo')`. Sem dependência externa.

**Como contribuo ou reporto um problema?**
Abra uma issue em https://github.com/inematds/cerebro-mcp. Se for um caso de caminho que passou pela verificação de segurança, inclua o caminho e o sistema operacional.
