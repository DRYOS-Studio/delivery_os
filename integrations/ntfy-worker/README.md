# Worker ntfy → DeliveryOS

Repassa alertas do servidor **ntfy self-hosted** (VPS Dryos) para o endpoint seguro do DeliveryOS (`POST /api/integrations/ntfy`).

## Variáveis de ambiente

| Nome | Obrigatório | Descrição |
|------|-------------|-----------|
| `NTFY_BASE_URL` | não | Base do ntfy (ex. `https://ntfy.dryos.internal`) |
| `NTFY_TOPICS` | sim | Tópicos separados por vírgula |
| `NTFY_TOKEN` | não | Token/ACL do ntfy (header `Authorization: Bearer`) |
| `DELIVERY_NTFY_INGEST_URL` | sim | URL completa do ingest (ex. `https://delivery-os-phi.vercel.app/api/integrations/ntfy`) |
| `NTFY_INGEST_SECRET` | sim | Mesmo valor de `NTFY_INGEST_SECRET` no Vercel (**não** é token MCP) |
| `NTFY_WORKER_STATE_FILE` | não | Arquivo local com último `since` (padrão `./ntfy-worker-state.json`) |
| `NTFY_RECONNECT_MS` | não | Espera entre reconexões (padrão 5000) |

No Vercel, crie apenas o secret **`NTFY_INGEST_SECRET`**.

## Mapeamento de severidade (priority 1–5)

Padrão no banco (`priority_severity_map` por tópico):

| Priority ntfy | Severidade SLA |
|---------------|----------------|
| 1–2 | `low` |
| 3 | `medium` |
| 4–5 | `high` |

Documentação canônica no código: `src/lib/integrations/ntfy/severity-map.ts`.

## Instalação na VPS (systemd)

1. Copie `index.mjs` e `package.json` para `/opt/dryos-ntfy-worker/`.
2. Crie `/etc/dryos/ntfy-worker.env` com as variáveis acima (permissão `600`).
3. Instale a unit: `sudo cp dryos-ntfy-worker.service /etc/systemd/system/`
4. `sudo systemctl daemon-reload`
5. `sudo systemctl enable --now dryos-ntfy-worker`
6. Logs: `journalctl -u dryos-ntfy-worker -f`

## Docker

```bash
docker build -t dryos-ntfy-worker .
docker run --rm --env-file /etc/dryos/ntfy-worker.env dryos-ntfy-worker
```

## Cadastro de tópicos

Antes de ingerir, mapeie cada tópico na Operação (UI **SLA → Tópicos ntfy** ou MCP `create_operation_ntfy_topic`). Tópicos sem mapeamento aparecem em **Admin → Triagem ntfy** (`/admin/ntfy-triage`).

## Recovery automático

Tags configuráveis por tópico (padrão `resolved`, `recovery`) fecham o incidente aberto do mesmo tópico e registram `closed_via` (ex. `ntfy:tag:resolved`).
