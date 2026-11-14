# cerebro-mcp

**🇧🇷 [Português](README.md) · 🇺🇸 [English](README.en.md) · 🇪🇸 [Español](README.es.md)**

Servidor **MCP** (Model Context Protocol) que expone tu **segundo cerebro** — la carpeta Markdown creada por el kit [astra-2cerebro](https://github.com/inematds/astra-2cerebro) — como herramientas para cualquier cliente MCP: **Claude Code, Codex, Claude Desktop, n8n, bots** y scripts.

Un cerebro. Varios clientes. Ninguna copia.

## 📖 Guía de uso

Guía completa (landing + paso a paso): **https://inematds.github.io/cerebro-mcp/guia/es/**

```
                     ┌──────────────┐
  Claude Code ──┐    │              │
  Codex ────────┼──► │  cerebro-mcp │ ──► ~/meu-cerebro/  (AGENTS.md, contexto/, wiki/, decisoes/ ...)
  Claude Desktop┤    │   (stdio ou  │
  n8n / bot ────┘    │    HTTP)     │
                     └──────────────┘
```

## Por qué

El kit astra-2cerebro guarda quién eres, qué haces, tus prioridades, decisiones, proyectos y una wiki interconectada — todo en archivos Markdown. Esto funciona muy bien para el agente que abre la carpeta. Pero Codex en la terminal, Claude Desktop en la laptop, un flujo en n8n y un bot en el celular no abren la carpeta.

`cerebro-mcp` resuelve esto: inicia un servidor MCP apuntado a la carpeta y cada cliente pasa a tener `cerebro_contexto`, `cerebro_buscar`, `cerebro_ler`, `cerebro_registrar_decisao` y las demás herramientas. El cerebro sigue siendo solo archivos; lo que cambia es quién puede leerlos.

## Instalación en 1 minuto

Necesitas Node.js 20 o superior.

```bash
git clone https://github.com/inematds/cerebro-mcp.git
cd cerebro-mcp
npm install
npm test                      # 42 testes contra a fixture em test/fixture

# aponte para o seu cérebro e teste por stdio
CEREBRO_DIR=~/meu-cerebro node scripts/teste-stdio.mjs ~/meu-cerebro
```

Registrar en **Claude Code** (una línea):

```bash
claude mcp add cerebro -e CEREBRO_DIR=/caminho/do/cerebro -- node /caminho/cerebro-mcp/bin/cerebro-mcp.mjs
```

Codex, Claude Desktop, `.mcp.json` del proyecto y modo HTTP: consulta **[INSTALAR.md](INSTALAR.md)**.

## Cómo funciona

```bash
cerebro-mcp [--dir <pasta>] [--escrita] [--http <porta>] [--host <ip>]
```

| Configuración | Cómo | Predeterminado |
|---|---|---|
| Carpeta del cerebro | `--dir <pasta>` o `CEREBRO_DIR` | carpeta actual, si tiene `AGENTS.md` o `CLAUDE.md`; de lo contrario, error claro |
| Escritura | `--escrita` o `CEREBRO_ESCRITA=1` | desactivada (solo lectura) |
| Transporte | `--http <porta>` | stdio |
| Dirección HTTP | `--host <ip>` | `127.0.0.1` |

Sin `--http`, el servidor se comunica mediante MCP por **stdio** — es lo que usan Claude Code, Codex y Claude Desktop. Con `--http`, inicia un endpoint **Streamable HTTP** (`POST /mcp`, sin sesión) para n8n, bots y scripts en la misma máquina.

## Herramientas

| Herramienta | Qué hace | ¿Escritura? |
|---|---|---|
| `cerebro_contexto()` | `contexto/sobre-mim.md` + `sobre-o-trabalho.md` + `prioridades.md`, concatenados con las rutas | no |
| `cerebro_prioridades()` | Solo `contexto/prioridades.md` | no |
| `cerebro_rotas()` | La sección "Mapa de rotas" de `AGENTS.md` (o `CLAUDE.md`) | no |
| `cerebro_buscar(consulta, limite?)` | Busca términos en todos los `.md` (título > ruta > wikilinks > frontmatter > cuerpo), con fragmento | no |
| `cerebro_ler(caminho)` | Contenido de un archivo (o listado de una carpeta) dentro del cerebro | no |
| `cerebro_wiki_indice()` | `wiki/index.md` | no |
| `cerebro_wiki_pagina(slug)` | Página de la wiki por slug, en `entidades/`, `conceitos/` o `fontes/` | no |
| `cerebro_projetos()` | Cada `projetos/<nome>/README.md` con la línea de estado | no |
| `cerebro_conexoes()` | La tabla de `conexoes.md` | no |
| `cerebro_rotinas(limite?)` | Rutinas activas y últimas ejecuciones de `rotinas/registro.md` | no |
| `cerebro_registrar_decisao(titulo, decisao, porque, alternativas?, responsavel?)` | Agrega una entrada fechada en `decisoes/registro.md` | **sí** |
| `cerebro_adicionar_fonte(nome, conteudo)` | Escribe `fontes/AAAA-MM-DD-<slug>.md` sin sobrescribir | **sí** |
| `cerebro_registrar_execucao(id, resultado, saida?, observacao?)` | Nueva línea al inicio de "Registro de execuções" | **sí** |

Las tres herramientas de escritura solo aparecen cuando el servidor se inicia con `--escrita`. Detalles, parámetros y ejemplos de retorno: **[docs/ferramentas.md](docs/ferramentas.md)**.

Además de las herramientas, cada `.md` se expone como **recurso** `cerebro://<caminho>` (por ejemplo, `cerebro://wiki/entidades/empresa-x.md`), para los clientes que prefieren "adjuntar" una nota.

## Ejemplos de conversación

Con el servidor registrado, el agente decide por sí solo cuándo llamar a cada herramienta.

> **Tú:** ¿Cuáles son mis prioridades de este trimestre?
> **Agente:** *(llama a `cerebro_prioridades`)* Tres, según `contexto/prioridades.md`: entregar la fase 2 del Proyecto Alfa para finales de octubre, lanzar el sitio nuevo y reducir el informe semanal de 4 horas a 1.

> **Tú:** ¿Por qué decidimos hacer el sitio con un generador estático?
> **Agente:** *(llama a `cerebro_buscar("site estático")` y luego a `cerebro_ler("decisoes/registro.md")`)* El 2026-08-20 registraste: costo cero y poco mantenimiento; cambiarías de opinión si necesitaras un área con inicio de sesión.

> **Tú:** Registra que aceptaremos la fase 2 con plazo en octubre.
> **Agente:** *(servidor con `--escrita`; llama a `cerebro_registrar_decisao`)* Registrado en `decisoes/registro.md` con la fecha de hoy. ¿Quieres que anote las alternativas consideradas?

> **Tú:** ¿Qué pidió la Empresa X en la última reunión?
> **Agente:** *(llama a `cerebro_wiki_pagina("empresa-x")` y sigue los enlaces a la fuente)* Aprobó el alcance de la fase 2 y quedó de definir quién valida los informes semanales.

## Seguridad

- **Lectura predeterminada.** Sin `--escrita`, las herramientas de escritura ni siquiera se registran: el cliente no las ve. E incluso cuando están registradas, el núcleo vuelve a verificar la bandera antes de escribir.
- **Solo dentro de la carpeta.** Todas las rutas pasan por `caminhoSeguro`: las resuelve, verifica el prefijo, sigue los symlinks y vuelve a verificar. Se rechazan `../`, las rutas absolutas externas y los enlaces que apuntan hacia afuera.
- **`.env`, `.git` y `node_modules` son invisibles**, incluso para lectura.
- **HTTP solo en `127.0.0.1`** de forma predeterminada, sin autenticación. Si lo expones en otra interfaz, coloca un proxy con autenticación delante — y recuerda que un cerebro contiene datos personales.
- **Nada sale de la máquina.** El servidor no realiza solicitudes externas.

Más detalles en **[docs/seguranca.md](docs/seguranca.md)**.

## Pruebas

```bash
npm test            # node --test: núcleo, escritura y servidor (cliente MCP en memoria)
npm run teste:stdio # inicia el binario real y se comunica por JSON-RPC mediante stdio
npm run teste:http  # inicia --http en un puerto libre y hace las llamadas que haría n8n
```

Resultado real de la prueba de humo por stdio (`node scripts/teste-stdio.mjs`, contra `test/fixture`):

```
[servidor] [cerebro-mcp] listo por stdio — cerebro en .../test/fixture (escritura desactivada)
OK  initialize → servidor cerebro-mcp 1.0.0 (protocolo 2025-06-18)
OK  tools/list → 10 herramientas: cerebro_contexto, cerebro_prioridades, cerebro_rotas, cerebro_buscar, cerebro_ler, cerebro_projetos, cerebro_conexoes, cerebro_rotinas, cerebro_wiki_indice, cerebro_wiki_pagina
OK  tools/call cerebro_buscar → 2 resultado(s) para "empresa x":
OK  tools/call cerebro_rotas → sección encontrada
OK  tools/call cerebro_ler ../../etc/passwd → isError (Erro: Acesso negado: "../../etc/passwd" está fora do cérebro.)
OK  resources/list → 27 recursos cerebro://
```

Con `--escrita`, `tools/list` devuelve 13 herramientas (las 10 anteriores más `cerebro_registrar_decisao`, `cerebro_adicionar_fonte` y `cerebro_registrar_execucao`). `npm test` cubre: búsqueda (relevancia, acentos, wikilinks, carpetas ignoradas), lectura con bloqueo de traversal/symlink/`.env`, extracción de rutas y prioridades, proyectos, conexiones, rutinas, wiki, recursos, escritura bloqueada sin `--escrita` y funcional con ella (en una copia temporal de la fixture).

## Documentación

- [INSTALAR.md](INSTALAR.md) — Claude Code, Codex, Claude Desktop, `.mcp.json`, HTTP e instrucciones para que un agente lo instale por su cuenta.
- [docs/arquitetura.md](docs/arquitetura.md) — cómo está organizado el código.
- [docs/ferramentas.md](docs/ferramentas.md) — cada herramienta con parámetros, retorno y ejemplo.
- [docs/seguranca.md](docs/seguranca.md) — qué se bloquea y por qué.
- [docs/exemplos.md](docs/exemplos.md) — n8n, bot y sitio que llaman al servidor en modo HTTP.
- [docs/faq.md](docs/faq.md) — preguntas frecuentes.

## FAQ breve

**¿Necesito el kit astra-2cerebro?** El servidor lee la estructura que crea el kit. Se inicia con cualquier carpeta que tenga `AGENTS.md` o `CLAUDE.md`, pero las herramientas de contexto, wiki y rutinas esperan los archivos del kit.

**¿Puedo apuntar dos clientes al mismo cerebro?** Sí. Cada cliente inicia su propio proceso del servidor; todos leen la misma carpeta. La escritura simultánea es rara y las tres operaciones solo agregan texto.

**¿El servidor indexa en algún lugar?** No. La búsqueda recorre los `.md` en cada llamada. Es instantánea para cerebros con cientos de notas; para miles sigue siendo aceptable.

**¿Funciona en Windows?** Sí, con Node 20+. En los ejemplos, cambia las rutas.

Más información en [docs/faq.md](docs/faq.md).

## Créditos y licencia

Creado para el kit **[astra-2cerebro](https://github.com/inematds/astra-2cerebro)** — la estructura de carpetas y los formatos de decisiones, rutinas, conexiones y wiki vienen de allí. Usa el SDK oficial `@modelcontextprotocol/sdk`.

MIT — Copyright (c) 2026 inematds.
