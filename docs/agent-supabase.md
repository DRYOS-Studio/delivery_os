# Usuário agente (IA) via Supabase

Guia curto para operar o Delivery com um usuário dedicado (ex.: Jon) **sem** expor segredos no repo. Ajuste nomes e políticas no Supabase Dashboard conforme seu ambiente.

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
- **Scripts / automação:** `SUPABASE_SECRET_KEY` (service role) **não** deve ser o padrão para o agente de produto: bypassa RLS. Prefira JWT do usuário agente.

## 4. Tabelas que o agente costuma ler

Escopo real depende de `operation_members` e RLS; em geral:

- **Cliente / Operação:** `clients`, `operations`, `frentes`, `operation_members`
- **Tarefas:** `tasks`, `task_assignees`, `task_comments` (se migration aplicada)
- **Eventos / decisões:** `meetings`, `decisions`, `meeting_attendees`
- **Histórico:** `activity_events` (linhas visíveis quando `can_read_activity_subject` é true)
- **Anexos:** metadados em `attachments` (arquivos no Storage com path `operation_id/...`)

## 5. Escrita

Use **Server Actions** ou rotas que já aplicam validação e convênios do app. Escrever SQL direto com credenciais erradas pode violar invariantes (status acionável, XOR tarefa, arquivamento em cascata).

- Preferência: consumir a API HTTP do app ou o servidor MCP (quando disponível) em vez de `INSERT` manual.

## 6. Servidor MCP (JSON-RPC sobre HTTP)

- **URL:** `POST ${NEXT_PUBLIC_APP_URL}/api/mcp` (ex.: `http://localhost:3000/api/mcp` em dev).
- **Autenticação:** header `Authorization: Bearer <access_token>` com o **JWT do Supabase** do usuário agente (obtido após `signInWithPassword` ou fluxo equivalente). Não usar `SUPABASE_SECRET_KEY` aqui — o servidor instancia um cliente com **anon key + JWT** para respeitar RLS como o usuário.
- **Discovery:** `GET /api/mcp` devolve um resumo do endpoint.
- **Protocolo:** JSON-RPC 2.0; métodos mínimos `initialize`, `notifications/initialized`, `tools/list`, `tools/call`. Ferramentas atuais: `list_operations`, `get_operation` (somente leitura).
- Estender o catálogo em `src/app/api/mcp/route.ts` mantendo o mesmo padrão de auth.

## 7. O que não colocar no repositório

- Senhas, service role, URLs de webhook com segredo embutido, tokens de API pessoais.

## 8. Variáveis de ambiente (referência)

Documentadas em `.env.local.example`: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY` (só backend), `CRON_SECRET`, `NOTIFICATION_WEBHOOK_URL`.
