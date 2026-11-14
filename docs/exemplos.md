# Exemplos de integração (modo HTTP)

Para clientes que não falam stdio — n8n, bots, um site local — suba o servidor em HTTP:

```bash
CEREBRO_DIR=/home/voce/meu-cerebro node /home/voce/cerebro-mcp/bin/cerebro-mcp.mjs --http 3333
# [cerebro-mcp] HTTP em http://127.0.0.1:3333/mcp (escrita desligada)
```

O que todo exemplo abaixo precisa saber (verificado com `npm run teste:http`):

| Item | Valor |
|---|---|
| Endpoint | `POST http://127.0.0.1:3333/mcp` |
| Cabeçalhos | `Content-Type: application/json` e **`Accept: application/json, text/event-stream`** (sem o segundo, resposta `406`) |
| Corpo | JSON-RPC 2.0: `{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"...","arguments":{...}}}` |
| Sessão | nenhuma — `tools/list` e `tools/call` funcionam **sem** `initialize` antes |
| Resposta | JSON simples: `{"jsonrpc":"2.0","id":1,"result":{"content":[{"type":"text","text":"..."}]}}` |
| Saúde | `GET http://127.0.0.1:3333/saude` → `{"ok":true,...}` |

O texto útil está sempre em `result.content[0].text`. Erro de ferramenta vem com `result.isError: true`.

---

## 1. Chamada crua (para testar)

```bash
curl -s http://127.0.0.1:3333/mcp \
  -H 'Content-Type: application/json' \
  -H 'Accept: application/json, text/event-stream' \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"cerebro_prioridades","arguments":{}}}'
```

Listar as ferramentas:

```bash
curl -s http://127.0.0.1:3333/mcp \
  -H 'Content-Type: application/json' \
  -H 'Accept: application/json, text/event-stream' \
  -d '{"jsonrpc":"2.0","id":2,"method":"tools/list","params":{}}'
```

---

## 2. n8n

Um fluxo "pergunta → resposta com contexto do cérebro":

1. **Trigger** (Webhook, Telegram, Cron — o que for).
2. **HTTP Request** — buscar no cérebro:
   - Method: `POST`
   - URL: `http://127.0.0.1:3333/mcp` (se o n8n roda em Docker, use o IP do host ou `host.docker.internal` e suba o servidor com `--host 0.0.0.0` **só se a rede for sua**).
   - Headers: `Content-Type: application/json`, `Accept: application/json, text/event-stream`
   - Body (JSON):
     ```json
     {
       "jsonrpc": "2.0",
       "id": 1,
       "method": "tools/call",
       "params": {
         "name": "cerebro_buscar",
         "arguments": { "consulta": "{{ $json.pergunta }}", "limite": 5 }
       }
     }
     ```
3. **Set / Code** — pegar o texto: `{{ $json.result.content[0].text }}`.
4. **Nó de IA** (o modelo que você usa no n8n) com o prompt: "Contexto do cérebro:\n{{ texto }}\n\nPergunta: {{ pergunta }}".
5. **Responder** ao canal de origem.

Para registrar uma decisão a partir do n8n, suba o servidor com `--escrita` e chame `cerebro_registrar_decisao` com `titulo`, `decisao` e `porque` no `arguments`.

---

## 3. Bot (Node.js)

Um bot de mensagens que responde perguntas sobre o cérebro. A parte do bot varia por plataforma; a chamada ao servidor é sempre esta função:

```js
// cerebro-cliente.mjs — cliente mínimo do modo HTTP
const URL_MCP = process.env.CEREBRO_MCP_URL ?? 'http://127.0.0.1:3333/mcp';
let id = 0;

export async function chamarFerramenta(nome, argumentos = {}) {
  const resposta = await fetch(URL_MCP, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      accept: 'application/json, text/event-stream',
    },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: ++id,
      method: 'tools/call',
      params: { name: nome, arguments: argumentos },
    }),
  });
  if (!resposta.ok) throw new Error(`cerebro-mcp respondeu ${resposta.status}`);
  const json = await resposta.json();
  if (json.error) throw new Error(json.error.message);
  const texto = json.result.content.map((c) => c.text).join('\n');
  if (json.result.isError) throw new Error(texto);
  return texto;
}

// uso:
// const contexto = await chamarFerramenta('cerebro_contexto');
// const achados  = await chamarFerramenta('cerebro_buscar', { consulta: 'reunião empresa x', limite: 3 });
```

No handler de mensagem do bot:

```js
import { chamarFerramenta } from './cerebro-cliente.mjs';

async function responder(pergunta) {
  const achados = await chamarFerramenta('cerebro_buscar', { consulta: pergunta, limite: 5 });
  const prioridades = await chamarFerramenta('cerebro_prioridades');
  // Monte o prompt para o seu modelo com `prioridades` + `achados` + `pergunta`
  // e devolva a resposta do modelo ao usuário.
  return `Prioridades:\n${prioridades}\n\nAchei no cérebro:\n${achados}`;
}
```

---

## 4. Site ou painel local

Uma página estática servida na mesma máquina pode chamar o servidor direto. Como o `fetch` do navegador exige CORS, coloque a página **atrás do mesmo host** (por exemplo, um pequeno proxy Node que serve os arquivos e repassa `/mcp`), ou use o cliente acima num backend. Exemplo de proxy mínimo:

```js
// proxy.mjs — serve ./site e repassa POST /mcp para o cerebro-mcp
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

const ALVO = 'http://127.0.0.1:3333/mcp';
http.createServer(async (req, res) => {
  if (req.method === 'POST' && req.url === '/mcp') {
    const corpo = await new Promise((ok) => { let s = ''; req.on('data', (d) => (s += d)); req.on('end', () => ok(s)); });
    const r = await fetch(ALVO, {
      method: 'POST',
      headers: { 'content-type': 'application/json', accept: 'application/json, text/event-stream' },
      body: corpo,
    });
    res.writeHead(r.status, { 'content-type': 'application/json' });
    res.end(await r.text());
    return;
  }
  const arquivo = path.join('site', req.url === '/' ? 'index.html' : req.url);
  if (fs.existsSync(arquivo)) { res.end(fs.readFileSync(arquivo)); } else { res.writeHead(404); res.end(); }
}).listen(8080, '127.0.0.1');
```

E no `site/index.html`:

```html
<input id="p" placeholder="Pergunte ao cérebro"> <button id="b">Buscar</button>
<pre id="r"></pre>
<script>
  document.getElementById('b').onclick = async () => {
    const consulta = document.getElementById('p').value;
    const resp = await fetch('/mcp', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/call',
        params: { name: 'cerebro_buscar', arguments: { consulta, limite: 5 } } }),
    });
    const json = await resp.json();
    document.getElementById('r').textContent = json.result.content[0].text;
  };
</script>
```

---

## 5. Python

```python
import requests

URL = "http://127.0.0.1:3333/mcp"
CABECALHOS = {"Content-Type": "application/json", "Accept": "application/json, text/event-stream"}

def chamar(nome, argumentos=None):
    corpo = {"jsonrpc": "2.0", "id": 1, "method": "tools/call",
             "params": {"name": nome, "arguments": argumentos or {}}}
    r = requests.post(URL, json=corpo, headers=CABECALHOS, timeout=30)
    r.raise_for_status()
    resultado = r.json()["result"]
    texto = "\n".join(c["text"] for c in resultado["content"])
    if resultado.get("isError"):
        raise RuntimeError(texto)
    return texto

print(chamar("cerebro_rotas"))
print(chamar("cerebro_buscar", {"consulta": "site novo", "limite": 3}))
```

---

## Deixar o servidor rodando

`systemd` (usuário):

```ini
# ~/.config/systemd/user/cerebro-mcp.service
[Unit]
Description=cerebro-mcp (HTTP)

[Service]
Environment=CEREBRO_DIR=/home/voce/meu-cerebro
ExecStart=/usr/bin/node /home/voce/cerebro-mcp/bin/cerebro-mcp.mjs --http 3333
Restart=on-failure

[Install]
WantedBy=default.target
```

```bash
systemctl --user daemon-reload && systemctl --user enable --now cerebro-mcp
```

Ou `pm2 start /home/voce/cerebro-mcp/bin/cerebro-mcp.mjs --name cerebro-mcp -- --http 3333` com `CEREBRO_DIR` no ambiente.
