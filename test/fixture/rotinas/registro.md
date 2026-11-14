# Rotinas

Rotinas ativas e registro de execuções. Criadas por `/rotina`. O `/auditar` usa este arquivo como evidência de cadência: uma rotina só conta se tiver execuções registradas.

## Rotinas ativas

| ID | Nome | Gatilho | Mecanismo | Saída esperada | Como parar | Criada em |
|---|---|---|---|---|---|---|
| R1 | Relatório semanal | sexta-feira, 9h | manual | `fontes/AAAA-MM-DD-relatorio-semanal.md` | apagar a linha | 2026-08-22 |

**Mecanismos:** `manual` (você roda um comando em dia fixo), `agendado` (cron, agendador do sistema, ou rotina agendada do agente), `evento` (hook, webhook, chegada de arquivo).

## Registro de execuções

Mais recente no topo. Uma linha por execução.

| Data e hora | ID | Resultado | Saída produzida | Observação |
|---|---|---|---|---|
| 2026-08-29 09:12 | R1 | ok | fontes/2026-08-29-relatorio-semanal.md | primeira execução |
