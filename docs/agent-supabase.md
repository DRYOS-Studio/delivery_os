# Usuário agente (IA) via Supabase

Guia curto para operar o Delivery com um usuário dedicado (ex.: Jon) **sem** colar JWT de sessão do browser no conector. Ajuste nomes e políticas no Supabase Dashboard conforme seu ambiente.

## 1. Criar o usuário

1. **Authentication → Users → Add user** — e-mail técnico (ex.: `agent.jon@interno.dryos`) e senha forte gerada no momento (guarde no Bitwarden ou cofre do time, não no Git).
2. O trigger `create_profile_on_user_signup` cria uma linha em `public.profiles` com `role = 'member'`.
3. Se o agente precisar de operações específicas, um admin adiciona linhas em `operation_members` (`profile_id` = UUID do usuário). Admin sem `operation_members` vê tudo por `is_admin()`.

## 2. Papéis

| `profiles.role` | Efeito |
|---|---|
| `member` | Vê só Operações listadas em `operation_members` (e dados filhos via RLS). |
| `admin` | Acesso total autenticado (use só se o agente realmente precisar). |

Tarefas de **área** usam RLS adicional (`user_in_area` + concessão). Um member só enxerga o que a combinação membership + área permite.

## 3. Como autenticar

- **App / API:** sessão Supabase (JWT) — `signInWithPassword` no cliente ou fluxo server com `@supabase/ssr`.
- **Scripts / automação:** chave **service role** (`SUPABASE_SERVICE_ROLE_KEY`, ou legado `SUPABASE_SECRET_KEY`) bypassa RLS — **não** deve ser o padrão para o agente de produto. Prefira JWT do usuário agente ou o fluxo MCP abaixo.

## 4. Tabelas que o agente costuma ler

Escopo real depende de `operation_members` e RLS; em geral:

- **Cliente / Operação:** `clients`, `operations`, `frentes`, `operation_members`
- **Tarefas:** `tasks`, `task_assignees`, `task_comments` (se migration aplicada)
- **Eventos / decisões:** `meetings`, `decisions`, `meeting_attendees`
- **Histórico:** `activity_events` (linhas visíveis quando `can_read_activity_subject` é true)
- **Anexos:** metadados em `attachments` (arquivos no Storage com path `operation_id/...`)

## 5. Escrita

Use **Server Actions** ou rotas que já aplicam validação e convênios do app. Escrever SQL direto com credenciais erradas pode violar invariantes (status acionável, XOR tarefa, arquivamento em cascata).

- Preferência: consumir o servidor MCP (`POST /api/mcp`) com um dos modos de auth da seção 6.

## 6. Servidor MCP (JSON-RPC 2.0 sobre HTTP)

| Item | Valor |
|---|---|
| URL | `POST ${NEXT_PUBLIC_APP_URL}/api/mcp` (ex.: `http://localhost:3000/api/mcp` em dev) |
| Discovery | `GET /api/mcp` — resumo JSON (sem OAuth discovery; não há `WWW-Authenticate` automático) |
| Protocolo | `initialize`, `notifications/initialized`, `tools/list`, `tools/call`; erros JSON-RPC (`code` / HTTP status quando aplicável) |

### 6.1 Autenticação (dois modos)

**A) JWT Supabase (sessão curta)**  
`Authorization: Bearer <access_token>` — o mesmo token que o PostgREST aceita. RLS e visibilidade são os do usuário dono do JWT.

**B) Token MCP estático (durável, revogável)**  
`Authorization: Bearer mcp_agt_<segredo>` — criado no **Admin → usuário** (mostrado **uma vez**). O servidor:

1. Chama `verify_mcp_agent_token` com **service role** (só no backend; a função não é exposta ao cliente).
2. Recusa token revogado/expirado, fingerprint inválido, usuário sem linha em `auth.users`, ou conta banida (`auth.users.banned_until`).
3. Obtém um **access token real** emitido pelo **GoTrue** (assinatura do projeto — tipicamente **ES256** com JWT Signing Keys), via Auth Admin API:
   - `auth.admin.getUserById(profile_id)` (o usuário agente precisa de **e-mail** em `auth.users`);
   - `auth.admin.generateLink({ type: 'magiclink', email })` (não envia e-mail ao usar `token_hash` no servidor);
   - `auth.verifyOtp({ type: 'email', token_hash })` com chave publicável → `session.access_token`.
   Não é possível (nem recomendado) assinar esse JWT localmente com JWKS público — a chave privada fica só no Supabase. Ver [JWT Signing Keys](https://supabase.com/docs/guides/auth/signing-keys).

4. O request segue com cliente **publishable key + access_token** — **mesma RLS** que o modo A.

**Legado (JWT secret simétrico):** se `SUPABASE_JWT_SECRET` estiver definido e `MCP_SESSION_STRATEGY` não for `gotrue`, o servidor ainda pode mintar HS256 local (~15 min) para projetos não migrados. Projetos só ES256 devem **omitir** `SUPABASE_JWT_SECRET` ou forçar `MCP_SESSION_STRATEGY=gotrue`.

Variáveis servidor modo B (ES256 / padrão): `SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`. Opcional legado: `SUPABASE_JWT_SECRET`, `MCP_SESSION_STRATEGY`.

**Escopos (modo B):** array `read` / `write` na linha `profile_agent_tokens`. Ferramentas que **escrevem** (`create_task`, `update_task`, `change_task_status`, `add_task_comment`) exigem escopo `write`; só `read` → 403 JSON-RPC.

### 6.2 Idempotência (writes)

Opcional: `idempotency_key` (8–200 caracteres) nos tools de escrita. O servidor armazena a resposta de sucesso em `mcp_idempotent_responses` (só **service role**) por `(profile_id, tool, key)` e devolve o mesmo resultado em retries.

### 6.3 Ferramentas

| Nome | Leitura/Escrita | Notas |
|---|---|---|
| `list_operations` | read | `limit` 1–50 |
| `get_operation` | read | `operation_id` |
| `list_tasks` | read | Filtros: `operation_id`, `client_id`, `status[]`, `assignee_person_id`, `limit`, `offset` |
| `get_task` | read | `task_id` |
| `create_task` | write | Tarefa de **entrega**: `frente_id` obrigatório; demais campos alinhados a `taskSchema` (título, status, datas, tags, `quick_win_id`, `sla_incident_id`, `assignee_person_ids`, …). **Não** cria tarefa de área pelo MCP. |
| `update_task` | write | `task_id` + campos opcionais; `assignee_person_ids` substitui a lista |
| `change_task_status` | write | `task_id`, `status` |
| `add_task_comment` | write | `task_id`, `body`; autor = perfil do token |

Saídas compactas (JSON em `content` de texto) para reduzir tokens.

### 6.4 Limitações de segurança e produto

- Sem bypass de RLS com service role nas queries de domínio: operações e tarefas respeitam `can_see_operation` / `can_see_task` como no app.
- **Revogação:** admin revoga no `/admin` (ou delete do user em Auth em cascata com `profiles`). Remoção de `operation_members` afeta o que o JWT ainda enxerga na próxima request.
- Não há OAuth2 completo no endpoint; para o Cursor use **HTTPS URL + header estático** ou continue com JWT curto manual se preferir.

## 7. Teste isolado (CI / agente)

Com Postgres local (não Docker Supabase, não projeto remoto):

```bash
npm run test:mcp-isolated   # aplica todas as migrations + asserções MCP/RLS
npm run test                # inclui vitest `mcp-isolated-rls.integration.test.ts`
```

Script: `scripts/mcp-isolated-rls-test.sh` + bootstrap `scripts/isolated-pg-bootstrap.sql`.

## 8. Ordem de deploy (migrations)

Aplicar em ordem de timestamp no repositório; as relevantes ao MCP incluem:

1. `20261106220000_mcp_agent_tokens.sql` — tabela + RPCs  
2. `20261106220100_mcp_idempotent_calls.sql` — cache de idempotency  
3. `20261106220200_verify_mcp_agent_token_auth_user.sql` — validação contra `auth.users`

Depois: `npm run gen:types` e deploy do app (ES256: service role + publicável + `MCP_SESSION_STRATEGY=gotrue` se necessário).

## 9. Passos para o usuário (conexão segura)

1. Admin abre `/admin`, expande o usuário agente, em **Tokens MCP** define nome, validade (dias), escopos (read/write) e **Cria**.
2. Copia o valor `mcp_agt_...` **uma única vez** e cola no Cursor (Add MCP Server) como `Authorization: Bearer <token>` ou equivalente.
3. URL do servidor: `https://<seu-app>/api/mcp`.
4. Para desligar: **Revogar** no mesmo painel (invalidação imediata no verify).

## 10. O que não colocar no repositório

Senhas, service role, `SUPABASE_JWT_SECRET`, URLs de webhook com segredo embutido, tokens MCP ou JWT de sessão.

## 11. Variáveis de ambiente (referência)

Documentadas em `.env.local.example`: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_SECRET_KEY` (legado), `MCP_SESSION_STRATEGY` (opcional), `SUPABASE_JWT_SECRET` (opcional, legado HS256), `CRON_SECRET`, `NOTIFICATION_WEBHOOK_URL`.
