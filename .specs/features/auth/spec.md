# auth Specification

## Problem Statement

Hoje qualquer query Supabase retorna vazio porque a policy `authenticated_full_access` exige `auth.uid()` e ninguém está autenticado. Pra desbloquear toda a UI da semana 02+ (CRUDs, Home, Operações), precisa de um mecanismo de login. Time interno é pequeno (2-5 pessoas), uso interno, sem self-signup público. Magic link é o caminho de menor atrito (sem gerenciar senha, sem reset flow, sem signup form custom).

## Goals

- [ ] Usuário interno consegue logar via magic link no e-mail e ficar autenticado na sessão; rotas `(app)` ficam acessíveis só pra autenticado.
- [ ] Server Actions e Server Components conseguem chamar `createServer()` e obter o user atual; RLS começa a deixar passar dado.
- [ ] Logout encerra a sessão e redireciona pro login.

## Out of Scope

- **Tabela `profiles` + papéis Admin/Membro/Visualizador externo** — entra como feature separada na semana 02 quando precisarmos diferenciar permissões. Por agora, "está autenticado" = pode tudo (RLS sem 1 já é assim, registrado em AD-002).
- **Visualizador externo via token público** — fluxo de auth diferente (não Supabase Auth, só token). Vai na semana 03 (`public-link-skeleton`).
- **OAuth (Google/GitHub)** — descartado per AskUser. Pode entrar v2 se ganhar tração.
- **E-mail + senha + reset flow** — descartado per AskUser.
- **Self-signup** — descartado per AskUser. Convite manual pelo dashboard Supabase.
- **Allowlist de domínios** — desnecessário porque self-signup vai estar desligado no Supabase.
- **Custom SMTP (Resend etc)** — usa o SMTP default do Supabase no MVP. Trocar quando volume crescer ou quando precisar de e-mail customizado.
- **Onboarding/perfil/avatar** — fora de escopo. Só nome derivado do e-mail no header.
- **Recuperação de conta sem acesso ao e-mail** — caso de borda raro pra time interno; resolve por convite manual.

---

## User Stories

### P1: Login via magic link ⭐ MVP

**User Story**: Como membro interno da DRYOS, quero digitar meu e-mail numa página de login, receber um link no e-mail, clicar e ficar logado, pra acessar o app sem gerenciar senha.

**Why P1**: Sem isso, ninguém entra em rota `(app)` e RLS bloqueia toda query Supabase. É o gate de tudo.

**Acceptance Criteria**:

1. WHEN um usuário não autenticado visita `/` (ou qualquer rota dentro de `(app)`) THEN o middleware SHALL redirecionar pra `/login` preservando o destino original via query param `redirectTo`.
2. WHEN o usuário visita `/login` THEN a página SHALL renderizar um form com input de e-mail + botão "Enviar link" + descrição curta. Visual respeitando DS v2 (Funnel Display no título, Onest no corpo, cores `bg-bg`/`text-ink-soft`).
3. WHEN o usuário digita um e-mail válido e submete o form THEN uma Server Action SHALL chamar `supabase.auth.signInWithOtp({ email, options: { emailRedirectTo, shouldCreateUser: false } })` e retornar `ok({ email })` ou `err(message, code)`.
4. WHEN a Server Action retorna `ok` THEN a página SHALL mostrar tela de confirmação "Verifique seu e-mail em <email>" com botão "Reenviar link" e link "Trocar de e-mail".
5. WHEN o e-mail não está cadastrado no Supabase (convite ainda não enviado) THEN a Server Action SHALL retornar `err('Acesso não autorizado. Contate o admin.', 'not_invited')` e o form SHALL mostrar a mensagem. **Não confirma a existência do e-mail** (mensagem genérica pra não vazar enumeração).
   - Implementação: passar `shouldCreateUser: false` ao `signInWithOtp` — Supabase retorna erro `Signups not allowed for otp` que mapeamos.
6. WHEN o usuário clica no link recebido por e-mail THEN é direcionado pra `/auth/callback?code=...&next=<redirectTo>` que troca o code por sessão via `supabase.auth.exchangeCodeForSession()` e redireciona pro `next` (default `/`).
7. WHEN o callback falha (code inválido/expirado) THEN SHALL redirecionar pra `/login?error=callback_failed` que mostra mensagem de erro no form.
8. WHEN um usuário JÁ autenticado visita `/login` THEN o middleware SHALL redirecionar pra `/`.
9. WHEN qualquer Server Component dentro de `(app)` chama `createServer()` THEN SHALL conseguir ler a sessão via cookies e `auth.getUser()` retorna o user (não null).

**Independent Test**: Convidar um e-mail no dashboard Supabase. Visitar `/` → vai pra `/login`. Digitar o e-mail → ver tela "Verifique seu e-mail". Abrir e-mail, clicar link → cai em `/` autenticado. Testar com e-mail NÃO convidado → ver "Acesso não autorizado".

---

### P1: Logout ⭐ MVP

**User Story**: Como usuário autenticado, quero clicar num botão "Sair" e voltar pra tela de login, pra encerrar a sessão.

**Why P1**: Sem logout, sessão dura semanas; não há fim de turno. Mínimo de higiene de auth.

**Acceptance Criteria**:

1. WHEN o usuário autenticado clica no botão "Sair" (vai morar na sidebar/header — esqueleto agora, sidebar real na sem 02) THEN uma Server Action SHALL chamar `supabase.auth.signOut()` e redirecionar pra `/login`.
2. WHEN o logout completa THEN cookies de sessão SHALL ser limpos e qualquer query Supabase subsequente SHALL falhar com RLS (retorno vazio ou erro de auth).

**Independent Test**: Logar. Clicar "Sair". Conferir que `/` redireciona pra `/login` agora.

---

### P1: Helpers de auth no server e no client ⭐ MVP

**User Story**: Como dev, quero `getUser()` em Server Components e `useUser()` em Client Components, pra mostrar nome/avatar e proteger ações sem repetir boilerplate.

**Why P1**: Toda Server Action que muta dado começa com guard de auth (CLAUDE.md Invariante 14). Sem helper, isso vira 20 cópias do mesmo código.

**Acceptance Criteria**:

1. WHEN um Server Component/Action chama `getUser()` THEN SHALL retornar `User | null` (do `@supabase/supabase-js`) lendo de `createServer()`.
2. WHEN um Server Component/Action chama `requireUser()` THEN SHALL retornar `User` ou lançar redirect pra `/login` se null.
3. WHEN um Client Component chama `useUser()` THEN SHALL retornar `{ user: User | null, loading: boolean }` via subscription ao `onAuthStateChange` do browser client.
4. WHEN qualquer Server Action de mutação começar THEN SHALL seguir o pattern `const user = await requireUserAction(); if (!user.ok) return user;` retornando `ActionResult<T>` (CLAUDE.md "Server Actions" section) — `requireUserAction()` é variante que retorna `ActionResult<User>` em vez de throw, pra integrar com o padrão.

**Independent Test**: Criar Server Component dummy que chama `getUser()` e renderiza `user?.email`. Logar, ver e-mail. Sair, ver null/redirect.

---

### P2: UX da página `/login`

**User Story**: Como usuário, quero que a página de login não pareça quebrada — feedback claro de loading, erros legíveis, copy em pt-BR.

**Why P2**: O P1 já cobre a funcionalidade; P2 polimento. Mas vale entregar junto se for de baixo custo (formulário simples).

**Acceptance Criteria**:

1. WHEN o form está em envio THEN o botão SHALL mostrar estado disabled + texto "Enviando..." (ou spinner sutil).
2. WHEN há erro de validação client-side (e-mail vazio ou malformado) THEN SHALL prevenir submit e mostrar mensagem inline (ex: "Informe um e-mail válido").
3. WHEN o form é submetido com sucesso THEN a tela de confirmação SHALL mostrar o e-mail digitado em negrito + estimativa "Pode levar até 1 minuto."

---

### P3: Página `/auth/check-email` separada (vs in-place no `/login`)

**User Story**: Como dev, quero a tela de confirmação em rota própria pra possível link direto e e2e test mais limpo.

**Why P3**: Pode ficar in-place no `/login` (toggle de view via state) e simplificar. Promovo se a refatoração for trivial.

---

## Edge Cases

- WHEN o usuário clica num magic link expirado (>1h) THEN o callback SHALL redirecionar pra `/login?error=link_expired` mostrando "Link expirado. Solicite novo."
- WHEN o usuário clica num magic link num browser diferente do que abriu `/login` THEN o flow ainda funciona (cookies são setados pelo callback, independente da origem).
- WHEN dois magic links são gerados em sequência (usuário pediu 2x) THEN o último valida; o primeiro vira inválido — comportamento default do Supabase, sem mitigação custom.
- WHEN o usuário fecha o browser sem clicar no link THEN sessão NÃO existe; volta a `/login` no próximo acesso.
- WHEN a Server Action `signInWithMagicLink` falha por rate limit do Supabase THEN SHALL retornar `err('Muitas tentativas. Aguarde 1 minuto.', 'rate_limited')`.
- WHEN `SUPABASE_SECRET_KEY` ou `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` não estão setadas em produção THEN `createServer()` lança erro explícito (já implementado em `requiredEnv()` na sem 1).

---

## Success Criteria

How we know the feature is successful:

- [ ] Visitar `/` em janela anônima → `/login` (redirect funciona).
- [ ] Digitar e-mail convidado no Supabase, submit → tela "Verifique seu e-mail" em <2s.
- [ ] Clicar link no e-mail → cai em `/` logado em <3s.
- [ ] Digitar e-mail NÃO convidado → mensagem genérica "Acesso não autorizado".
- [ ] Clicar "Sair" → `/login` em <1s.
- [ ] Build e typecheck verdes; deploy na Vercel funciona com env vars já setadas.
- [ ] Não precisa ajustar RLS — a policy `authenticated_full_access` já existe; só precisamos de uma sessão pra ela liberar.
