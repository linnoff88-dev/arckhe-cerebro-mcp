# Segurança

Um segundo cérebro contém dados pessoais: quem você é, com quem trabalha, o que decidiu e por quê. O servidor foi desenhado para expor isso **só ao cliente que você configurou**, **só dentro da pasta**, e **sem escrever nada** a menos que você peça.

## 1. Leitura por padrão

- Sem `--escrita` (ou `CEREBRO_ESCRITA=1`), as ferramentas `cerebro_registrar_decisao`, `cerebro_adicionar_fonte` e `cerebro_registrar_execucao` **não são registradas**. O cliente nem as vê no `tools/list`; chamar pelo nome devolve "ferramenta não encontrada".
- Camada dupla: mesmo que alguém registre as ferramentas por engano, o núcleo (`Cerebro`) confere `this.escrita` de novo antes de tocar no disco e lança `ESCRITA_DESLIGADA`.
- As três operações **só acrescentam**. Nenhuma apaga ou sobrescreve: decisão vai ao fim do arquivo, fonte recebe sufixo `-2` se o nome já existir (gravação com `flag: 'wx'`), execução entra como linha nova numa tabela.

## 2. Só dentro da pasta

Todo acesso ao disco passa por `Cerebro.caminhoSeguro(caminho)`:

1. Rejeita caminho vazio ou com byte nulo.
2. `path.resolve(dir, caminho)` e confere que o resultado é `dir` ou começa com `dir + separador`. Isso elimina `../`, `..\\` e caminhos absolutos de fora.
3. Confere cada segmento do caminho relativo: `.git`, `node_modules` e qualquer nome começando com `.env` são recusados (`CAMINHO_PROTEGIDO`).
4. Segue symlinks: acha o trecho do caminho que existe, aplica `realpathSync` e confere o prefixo **de novo**. Um link `fuga -> /etc` dentro do cérebro não passa.

A mesma função protege `cerebro_ler`, as escritas e os recursos `cerebro://`. Os testes cobrem `../../etc/passwd`, `/etc/passwd`, `..`, `.env`, `.env.local`, `contexto/.env`, `.git/config`, `node_modules/x` e um symlink real para `/etc`.

## 3. O que a busca não vê

`cerebro_buscar` e `resources/list` pulam `.git`, `node_modules`, `.claude`, `.agents`, `.codex` e `apps`. Motivo: são skills e apps geradas pelo kit, não conhecimento — e as skills têm centenas de linhas que afogariam qualquer busca. Esses arquivos (menos `.git`/`node_modules`) continuam legíveis por `cerebro_ler` se o caminho for pedido explicitamente.

## 4. Nada sai da máquina

O servidor não faz requisição de rede alguma. Em stdio, ele só conversa com o processo pai (o cliente MCP). Em HTTP, só responde a quem chega em `127.0.0.1`.

## 5. Modo HTTP

- Escuta em `127.0.0.1` por padrão. `--host 0.0.0.0` é possível, mas **não há autenticação** — só faça isso atrás de um proxy que autentique (ou numa rede que você controla) e de preferência sem `--escrita`.
- Corpo limitado a 5 MB por requisição.
- Sem sessão (`stateless`): cada requisição é independente, não há estado para sequestrar.
- Erros internos devolvem `500` com mensagem genérica; o detalhe vai para o stderr do servidor.

## 6. O que continua sendo sua responsabilidade

- **O cliente MCP.** Tudo que o cliente pode ler, o modelo por trás dele pode ler. Configure o servidor só em clientes que você confia, e prefira somente leitura.
- **O repositório do cérebro.** Como o kit já recomenda: privado, sempre.
- **Chaves de API.** Guarde em `.env` (bloqueado pelo servidor), nunca em notas Markdown. O servidor não filtra segredos escritos no corpo de uma nota.
- **Escrita.** Ligue `--escrita` só no cliente em que você realmente quer que o agente registre coisas. Revisar `decisoes/registro.md` de vez em quando é parte do método.

## Erros e códigos

| Código | Quando |
|---|---|
| `SEM_CEREBRO` | nenhuma pasta configurada e a atual não tem `AGENTS.md`/`CLAUDE.md` |
| `DIR_INEXISTENTE` | `--dir`/`CEREBRO_DIR` aponta para pasta que não existe |
| `NAO_E_CEREBRO` | a pasta existe mas não tem `AGENTS.md`/`CLAUDE.md` |
| `FORA_DO_CEREBRO` | caminho resolve para fora da pasta (inclusive por symlink) |
| `CAMINHO_PROTEGIDO` | `.git`, `node_modules` ou `.env*` |
| `NAO_ENCONTRADO` | arquivo ou página da wiki inexistente |
| `ESCRITA_DESLIGADA` | operação de escrita sem `--escrita` |
| `CAMPOS_OBRIGATORIOS` | parâmetro obrigatório vazio |
| `FORMATO` | `rotinas/registro.md` sem a tabela esperada |
