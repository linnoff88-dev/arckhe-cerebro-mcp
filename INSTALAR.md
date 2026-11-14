# Instalar o cerebro-mcp

Passo a passo para cada cliente. Em todos os casos você precisa de:

1. **Node.js 20 ou superior** (`node --version`).
2. **Um cérebro** criado pelo kit [astra-2cerebro](https://github.com/inematds/astra-2cerebro) — uma pasta com `AGENTS.md`/`CLAUDE.md`, `contexto/`, `wiki/`, `decisoes/` etc. Nos exemplos ela é `/home/voce/meu-cerebro`.
3. **Este repositório clonado** com as dependências instaladas. Nos exemplos ele é `/home/voce/cerebro-mcp`.

```bash
git clone https://github.com/inematds/cerebro-mcp.git /home/voce/cerebro-mcp
cd /home/voce/cerebro-mcp
npm install
npm test
```

Teste rápido apontando para o seu cérebro (não precisa de cliente nenhum):

```bash
node scripts/teste-stdio.mjs /home/voce/meu-cerebro
```

Se aparecer `OK initialize`, `OK tools/list → 10 ferramentas` e os demais `OK`, está pronto.

> **Escrita.** Todos os exemplos abaixo sobem o servidor **somente leitura**. Para liberar `cerebro_registrar_decisao`, `cerebro_adicionar_fonte` e `cerebro_registrar_execucao`, acrescente o argumento `--escrita` (ou a variável `CEREBRO_ESCRITA=1`) na configuração do cliente.

---

## Claude Code

### Opção A — comando `claude mcp add` (escopo do usuário)

```bash
claude mcp add cerebro -e CEREBRO_DIR=/home/voce/meu-cerebro -- node /home/voce/cerebro-mcp/bin/cerebro-mcp.mjs
```

Com escrita:

```bash
claude mcp add cerebro -e CEREBRO_DIR=/home/voce/meu-cerebro -- node /home/voce/cerebro-mcp/bin/cerebro-mcp.mjs --escrita
```

Conferir e remover:

```bash
claude mcp list
claude mcp get cerebro
claude mcp remove cerebro
```

Dentro do Claude Code, `/mcp` mostra o servidor conectado e as ferramentas `cerebro_*`.

### Opção B — `.mcp.json` na raiz de um projeto (escopo do projeto, versionável)

Crie `/caminho/do/projeto/.mcp.json`:

```json
{
  "mcpServers": {
    "cerebro": {
      "command": "node",
      "args": ["/home/voce/cerebro-mcp/bin/cerebro-mcp.mjs"],
      "env": { "CEREBRO_DIR": "/home/voce/meu-cerebro" }
    }
  }
}
```

Na primeira vez, o Claude Code pede para aprovar o servidor do projeto.

### Opção C — dentro do próprio cérebro

Se você abre o Claude Code **na pasta do cérebro**, não precisa nem de `CEREBRO_DIR`: o servidor detecta `AGENTS.md`/`CLAUDE.md` na pasta atual.

```json
{
  "mcpServers": {
    "cerebro": {
      "command": "node",
      "args": ["/home/voce/cerebro-mcp/bin/cerebro-mcp.mjs"]
    }
  }
}
```

---

## Codex (OpenAI)

Edite `~/.codex/config.toml` e acrescente:

```toml
[mcp_servers.cerebro]
command = "node"
args = ["/home/voce/cerebro-mcp/bin/cerebro-mcp.mjs"]

[mcp_servers.cerebro.env]
CEREBRO_DIR = "/home/voce/meu-cerebro"
```

Com escrita, adicione `"--escrita"` em `args`:

```toml
args = ["/home/voce/cerebro-mcp/bin/cerebro-mcp.mjs", "--escrita"]
```

Reinicie o Codex. As ferramentas aparecem como `cerebro_contexto`, `cerebro_buscar` etc.

---

## Claude Desktop

Abra o arquivo de configuração:

- macOS: `~/Library/Application Support/Claude/claude_desktop_config.json`
- Windows: `%APPDATA%\Claude\claude_desktop_config.json`
- Linux: `~/.config/Claude/claude_desktop_config.json`

Acrescente (ou mescle com o que já existe):

```json
{
  "mcpServers": {
    "cerebro": {
      "command": "node",
      "args": ["/home/voce/cerebro-mcp/bin/cerebro-mcp.mjs"],
      "env": { "CEREBRO_DIR": "/home/voce/meu-cerebro" }
    }
  }
}
```

Reinicie o Claude Desktop. O ícone de ferramentas mostra o servidor `cerebro`.

> Se o `node` não estiver no PATH do app (comum no macOS), use o caminho completo, por exemplo `/usr/local/bin/node` ou o caminho que `which node` devolve no terminal.

---

## Via `npx` ou clone (qualquer cliente)

O pacote não está no registro do npm; o `npx` roda direto do GitHub (na primeira vez ele baixa e instala as dependências, ~20 s):

```bash
npx -y github:inematds/cerebro-mcp --versao                       # imprime 1.0.0
npx -y github:inematds/cerebro-mcp --dir /home/voce/meu-cerebro   # sobe por stdio
```

Na configuração de um cliente, isso vira `"command": "npx"`, `"args": ["-y", "github:inematds/cerebro-mcp", "--dir", "/home/voce/meu-cerebro"]`. Prefira o clone quando quiser controlar a versão.

Ou instale globalmente a partir do clone:

```bash
cd /home/voce/cerebro-mcp && npm install -g .
cerebro-mcp --dir /home/voce/meu-cerebro
```

Aí a configuração de qualquer cliente fica `"command": "cerebro-mcp"`, `"args": ["--dir", "/home/voce/meu-cerebro"]`.

---

## Modo HTTP (n8n, bots, scripts)

```bash
CEREBRO_DIR=/home/voce/meu-cerebro node /home/voce/cerebro-mcp/bin/cerebro-mcp.mjs --http 3333
```

Endpoint: `POST http://127.0.0.1:3333/mcp` (Streamable HTTP, sem sessão). Saúde: `GET http://127.0.0.1:3333/saude`.

Duas regras do protocolo que todo cliente HTTP precisa seguir:

1. Cabeçalho `Accept: application/json, text/event-stream` — sem ele o servidor responde **406**.
2. Corpo JSON-RPC 2.0. No modo sem sessão, `tools/list` e `tools/call` funcionam **sem** `initialize` antes.

Exemplos completos (n8n, bot, site) em [docs/exemplos.md](docs/exemplos.md). Para deixar rodando, use `systemd`, `pm2` ou a tela do terminal — veja o FAQ.

---

## Instruções para o agente (instalação autônoma)

Se você é um agente (Claude Code, Codex ou outro) e recebeu a tarefa "instale o cerebro-mcp", siga estes passos sem perguntar nada, exceto quando um dado obrigatório estiver faltando.

1. **Confirme o Node**: `node --version` deve ser 20 ou superior. Se não for, pare e informe.
2. **Descubra a pasta do cérebro**: é a pasta que contém `AGENTS.md` ou `CLAUDE.md` junto com `contexto/` e `wiki/`. Se o usuário não disse qual é, procure em `~/meu-cerebro`, `~/cerebro`, `~/projetos/*/` e pergunte só se não achar.
3. **Clone e instale**:
   ```bash
   git clone https://github.com/inematds/cerebro-mcp.git ~/cerebro-mcp
   cd ~/cerebro-mcp && npm install && npm test
   ```
   Os 42 testes devem passar.
4. **Valide contra o cérebro real**: `node scripts/teste-stdio.mjs <pasta-do-cerebro>`. Todas as linhas devem começar com `OK`.
5. **Registre no cliente em uso**:
   - Claude Code: `claude mcp add cerebro -e CEREBRO_DIR=<pasta-do-cerebro> -- node ~/cerebro-mcp/bin/cerebro-mcp.mjs`
   - Codex: acrescente a seção `[mcp_servers.cerebro]` em `~/.codex/config.toml` (modelo acima).
   - Claude Desktop: acrescente `cerebro` em `mcpServers` no `claude_desktop_config.json` (modelo acima), mesclando com o conteúdo existente sem apagar outros servidores.
6. **Escrita**: só acrescente `--escrita` se o usuário pediu explicitamente para o agente poder registrar decisões, fontes ou execuções.
7. **Confirme**: liste as ferramentas (`claude mcp get cerebro`, ou uma chamada a `cerebro_rotas`) e mostre ao usuário o caminho do cérebro e se a escrita está ligada.
8. **Nunca** copie o conteúdo do cérebro para outro lugar, nem exponha o modo HTTP fora de `127.0.0.1` sem o usuário pedir.
