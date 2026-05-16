# auth Tasks

**Design**: `.specs/features/auth/design.md`
**Status**: Draft

---

## Execution Plan

```
Phase 1 — Foundations (paralelo):
  T1 ─┐
  T2 ─┼─→ done
  T3 ─┘

Phase 2 — Auth core (após Phase 1):
  T4 (proxy) ──────────┐
  T5 (actions/auth)  ──┼─→ done
  T6 (callback route)  ┘

Phase 3 — UI (após Phase 2):
  T7 (login page) ─┐
  T8 (LoginForm)   ├─→ done
  T9 (home move)   │
  T10 (app layout) ┘

Phase 4 — Config + Validate (após Phase 3):
  T11 (Vercel env) → T12 (Supabase config + invite) → T13 (E2E test)
```

---

## Task Breakdown

### T1: `src/lib/actions/_types.ts` — ActionResult module [P]

**What**: Padrão de retorno unificado pra Server Actions, com helpers `ok`/`err`/`dbErr`.
**Where**: `src/lib/actions/_types.ts`
**Depends on**: None
**Reuses**: Snippet verbatim do CLAUDE.md seção "Server Actions"

**Tools**:
- Write
- Skill: `dryos-conventions` (TypeScript section)

**Done when**:
- [ ] Exporta `type ActionResult<T>` = discriminated union em `ok` (boolean)
- [ ] Exporta `ok<T>(data: T): ActionResult<T>`
- [ ] Exporta `err(error: string, code?: string): ActionResult<never>`
- [ ] Exporta `dbErr(error: { message: string }, context: string): ActionResult<never>`
- [ ] Sem `any`, sem `@ts-ignore`. Tipos retornados explícitos.
- [ ] `npm run typecheck` passa.

**Verify**:
```bash
grep -E "export (type|function|const) (ActionResult|ok|err|dbErr)" src/lib/actions/_types.ts && npm run typecheck
```

---

### T2: `src/lib/auth/server.ts` — server-side helpers [P]

**What**: `getUser`, `requireUser`, `requireUserAction`.
**Where**: `src/lib/auth/server.ts`
**Depends on**: T1 (`ActionResult`)
**Reuses**: `createServer()` de `src/lib/db/client.ts`; `redirect` de `next/navigation`

**Tools**:
- Write
- Skill: `dryos-conventions` (Server Actions section)

**Done when**:
- [ ] `async function getUser(): Promise<User | null>` — chama `createServer()` e retorna `data.user`
- [ ] `async function requireUser(redirectToOnFail?: string): Promise<User>` — se null, `redirect('/login?redirectTo=' + encodeURIComponent(redirectToOnFail ?? '/'))`
- [ ] `async function requireUserAction(): Promise<ActionResult<User>>` — retorna `ok(user)` ou `err('Sessão expirada.', 'unauthenticated')`
- [ ] Tipo `User` importado de `@supabase/supabase-js`
- [ ] Sem `any`. `npm run typecheck` passa.

**Verify**:
```bash
grep -E "export async function (getUser|requireUser|requireUserAction)" src/lib/auth/server.ts && npm run typecheck
```

---

### T3: `src/lib/auth/client.ts` — `useUser` hook [P]

**What**: Hook React pra Client Components reagirem a mudanças de auth.
**Where**: `src/lib/auth/client.ts`
**Depends on**: None (independente das outras, só usa `createBrowser`)
**Reuses**: `createBrowser()` de `src/lib/db/client.ts`

**Tools**:
- Write
- Skill: `dryos-conventions`

**Done when**:
- [ ] Arquivo começa com `'use client';`
- [ ] Exporta `function useUser(): { user: User | null; loading: boolean }`
- [ ] `useEffect` inicial chama `supabase.auth.getUser()` e seta state
- [ ] `useEffect` subscribe ao `supabase.auth.onAuthStateChange((event, session) => setUser(session?.user ?? null))`
- [ ] Cleanup do subscription no `return` do useEffect
- [ ] Tipo `User` importado de `@supabase/supabase-js`
- [ ] `npm run typecheck` passa.

**Verify**:
```bash
head -1 src/lib/auth/client.ts | grep -q "use client" && grep "useUser" src/lib/auth/client.ts && npm run typecheck
```

---

### T4: `src/proxy.ts` — Next 16 Proxy (session refresh + redirects)

**What**: Refresh transparente de cookies de sessão + redirect baseado em rota e auth.
**Where**: `src/proxy.ts`
**Depends on**: T1, T2 (conceptualmente; tecnicamente só usa Supabase SSR direto)
**Reuses**: Pattern de cookies do `createServer()` (mas adaptado pra `NextRequest`/`NextResponse`)

**Tools**:
- Write
- Reference: `node_modules/next/dist/docs/01-app/01-getting-started/16-proxy.md`
- Reference: `@supabase/ssr` middleware example (adaptado pra v16 nome `proxy`)

**Done when**:
- [ ] Export `async function proxy(request: NextRequest): Promise<NextResponse>` (named export, recomendado pela v16)
- [ ] Cria `response = NextResponse.next({ request })`
- [ ] Cria `supabase = createServerClient` lendo cookies de `request` e setando em `response` via `getAll`/`setAll`
- [ ] Chama `const { data: { user } } = await supabase.auth.getUser()` (REFRESH transparente)
- [ ] Define `isPublicPath` baseado em pathname: `/login`, `/auth/callback`, `/(public)/*`, `/api/webhooks/*`
- [ ] Se `!user && !isPublicPath` → `NextResponse.redirect(new URL('/login?redirectTo=' + pathname + search, request.url))`
- [ ] Se `user && pathname === '/login'` → `NextResponse.redirect(new URL('/', request.url))`
- [ ] Caso contrário → retorna `response`
- [ ] Export `const config = { matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)'] }`
- [ ] `npm run typecheck` passa. `npm run build` passa.

**Verify**:
```bash
test -f src/proxy.ts && \
  grep -q "export async function proxy" src/proxy.ts && \
  grep -q "export const config" src/proxy.ts && \
  npm run build
```

---

### T5: `src/lib/actions/auth.ts` — Server Actions

**What**: `signInWithMagicLinkAction` + `signOutAction`.
**Where**: `src/lib/actions/auth.ts`
**Depends on**: T1, T2
**Reuses**: `createServer()`, `ActionResult` helpers, `redirect`

**Tools**:
- Write
- Skill: `dryos-conventions` (Server Actions)

**Done when**:
- [ ] Arquivo começa com `'use server';`
- [ ] `signInWithMagicLinkAction(formData: FormData): Promise<ActionResult<{ email: string }>>`:
  - Lê e validações de `formData.get('email')` — tipo, formato (regex básico ou Zod)
  - Lê `redirectTo` opcional do form
  - Chama `supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: '<APP_URL>/auth/callback?next=<redirectTo>', shouldCreateUser: false } })`
  - Map errors:
    - Mensagem inclui `Signups not allowed` → `err('Acesso não autorizado. Contate o admin.', 'not_invited')`
    - HTTP 429 ou `rate` → `err('Muitas tentativas. Aguarde 1 minuto.', 'rate_limited')`
    - Default → `err('Falha ao enviar link. Tente novamente.', 'sign_in_failed')`
  - Sucesso → `ok({ email })`
- [ ] `signOutAction(): Promise<void>`:
  - Chama `supabase.auth.signOut()`
  - `redirect('/login')`
- [ ] Sem `any`. `npm run typecheck` passa.

**Verify**:
```bash
grep -q "'use server'" src/lib/actions/auth.ts && \
  grep -q "signInWithMagicLinkAction" src/lib/actions/auth.ts && \
  grep -q "signOutAction" src/lib/actions/auth.ts && \
  npm run typecheck
```

---

### T6: `src/app/auth/callback/route.ts` — Route Handler

**What**: Recebe magic link redirect, troca code por sessão.
**Where**: `src/app/auth/callback/route.ts`
**Depends on**: None técnico (`createServer()` já existe)

**Tools**:
- Write
- Skill: `dryos-conventions`

**Done when**:
- [ ] `export async function GET(request: Request): Promise<Response>`
- [ ] Lê `code` e `next` de `new URL(request.url).searchParams`
- [ ] Chama `supabase.auth.exchangeCodeForSession(code)`
- [ ] Sucesso → `NextResponse.redirect(new URL(next ?? '/', request.url))`
- [ ] Erro → `NextResponse.redirect(new URL('/login?error=callback_failed', request.url))`
- [ ] Code ausente → `NextResponse.redirect(new URL('/login?error=missing_code', request.url))`
- [ ] `npm run typecheck` passa.

**Verify**:
```bash
test -f src/app/auth/callback/route.ts && grep -q "exchangeCodeForSession" src/app/auth/callback/route.ts && npm run typecheck
```

---

### T7: `src/app/(public)/login/page.tsx` — Login page (Server Component) [P]

**What**: Página `/login`. Renderiza form via `<LoginForm />`. Passa `redirectTo` + `error` via searchParams.
**Where**: `src/app/(public)/login/page.tsx`
**Depends on**: T8 (importa componente)
**Reuses**: Layout root (fontes); DS tokens

**Tools**:
- Write
- Skill: `dryos-design-system` (tipografia + cores)

**Done when**:
- [ ] `export default async function LoginPage({ searchParams }): Promise<JSX.Element>`
- [ ] `searchParams` é `Promise<{ redirectTo?: string; error?: string }>` (Next 15+)
- [ ] Layout: `<main className="min-h-screen flex items-center justify-center bg-bg p-7">` com `<div className="w-full max-w-sm bg-card border border-line rounded shadow-sm p-7">`
- [ ] Título `<h1 className="font-display text-2xl text-ink mb-2">DRYOS Delivery</h1>`
- [ ] Subtítulo `<p className="font-mono text-xs text-mute mb-6">— entre com seu e-mail</p>`
- [ ] Renderiza `<LoginForm redirectTo={...} initialError={...} />`
- [ ] `npm run typecheck` + `npm run build` passa.

**Verify**:
```bash
test -f "src/app/(public)/login/page.tsx" && grep -q "LoginForm" "src/app/(public)/login/page.tsx" && npm run build
```

---

### T8: `src/components/auth/LoginForm.tsx` — Client form

**What**: Form de e-mail + estados idle/sending/sent/error. Chama Server Action.
**Where**: `src/components/auth/LoginForm.tsx`
**Depends on**: T5 (importa `signInWithMagicLinkAction`)
**Reuses**: DS tokens; Server Action de T5

**Tools**:
- Write
- Skill: `dryos-design-system`

**Done when**:
- [ ] `'use client'` no topo
- [ ] `useState<'idle' | 'sending' | 'sent' | 'error'>('idle')` + state `email`, `error?: string`, `code?: string`
- [ ] `useTransition` pro submit
- [ ] Form: `<form action={handleSubmit}>` com input `<input type="email" name="email" required>` e botão `<button type="submit">Enviar link</button>`
- [ ] Hidden input `<input type="hidden" name="redirectTo" value={redirectTo} />`
- [ ] Botão: classes DS — `bg-ink text-bg hover:bg-oak rounded px-3.5 py-2 text-[13px] font-medium disabled:opacity-50`
- [ ] Input: `bg-card border border-line rounded px-3 py-2 text-sm w-full`
- [ ] Estado `sending` → botão disabled + texto "Enviando..."
- [ ] Estado `sent` → troca view inteira: `<p>Verifique seu e-mail em <strong>{email}</strong></p>` + botão "Reenviar" + link "Trocar de e-mail"
- [ ] Estado `error` → mensagem em vermelho abaixo do botão: `<p className="text-critical text-xs mt-2">{error}</p>`
- [ ] `initialError` da prop é traduzido pra mensagem:
  - `callback_failed` → "Falha ao autenticar. Tente novamente."
  - `link_expired` → "Link expirado. Solicite novo."
  - `missing_code` → "Link inválido. Solicite novo."
- [ ] `npm run typecheck` + `npm run build` passa.

**Verify**:
```bash
head -1 src/components/auth/LoginForm.tsx | grep -q "use client" && grep -q "signInWithMagicLinkAction" src/components/auth/LoginForm.tsx && npm run build
```

---

### T9: Mover `page.tsx` pra `(app)/page.tsx` + adicionar logout

**What**: Move home placeholder pra dentro do route group `(app)` + adiciona botão "Sair" temporário.
**Where**:
- Delete: `src/app/page.tsx`
- Create: `src/app/(app)/page.tsx`
**Depends on**: T2 (`getUser`), T5 (`signOutAction`)
**Reuses**: tokens DS

**Tools**:
- Bash (`git mv`)
- Edit

**Done when**:
- [ ] `src/app/page.tsx` não existe mais
- [ ] `src/app/(app)/page.tsx` existe e renderiza:
  ```tsx
  export default async function Page() {
    const user = await getUser();
    return (
      <main className="p-7">
        <h1 className="font-display text-2xl text-ink">DRYOS Delivery</h1>
        <p className="font-mono text-xs text-mute mt-2">— semana 01 · setup</p>
        <p className="font-mono text-xs text-mute mt-4">logado: {user?.email ?? 'anon'}</p>
        <form action={signOutAction} className="mt-4">
          <button type="submit" className="text-xs font-mono text-critical hover:underline">sair</button>
        </form>
      </main>
    );
  }
  ```
- [ ] `npm run typecheck` + `npm run build` passa.

**Verify**:
```bash
test ! -f src/app/page.tsx && test -f "src/app/(app)/page.tsx" && grep -q "signOutAction" "src/app/(app)/page.tsx" && npm run build
```

---

### T10: `src/app/(app)/layout.tsx` — Wrapper minimal [P]

**What**: Layout pro route group `(app)`. Por agora só `{children}`; sidebar real entra na sem 02.
**Where**: `src/app/(app)/layout.tsx`
**Depends on**: None técnico

**Tools**:
- Write

**Done when**:
- [ ] `export default async function AppLayout({ children }: { children: React.ReactNode }): Promise<JSX.Element>`
- [ ] Retorna `<>{children}</>` (Fragment) ou `<div>{children}</div>` — preferir `<>{children}</>` pra não introduzir wrapper desnecessário
- [ ] `npm run typecheck` + `npm run build` passa.

**Verify**:
```bash
test -f "src/app/(app)/layout.tsx" && grep -q "AppLayout" "src/app/(app)/layout.tsx" && npm run build
```

---

### T11: Setar `NEXT_PUBLIC_APP_URL` na Vercel + local

**What**: Setar env var em produção e dev. Bloqueia `emailRedirectTo` apontar pro lugar certo.
**Where**: Vercel dashboard + `.env.local` local
**Depends on**: None

**Tools**:
- Vercel dashboard (manual): Project Settings → Environment Variables → adicionar `NEXT_PUBLIC_APP_URL` = `https://delivery-os-phi.vercel.app` em Production + Preview + Development.
- Local: `.env.local` deve ter `NEXT_PUBLIC_APP_URL=http://localhost:3000`.

**Done when**:
- [ ] Vercel: `NEXT_PUBLIC_APP_URL` setado em production = `https://delivery-os-phi.vercel.app`
- [ ] Local: arquivo `.env.local` existe com `NEXT_PUBLIC_APP_URL=http://localhost:3000` (+ outras vars já existentes)
- [ ] **Não comitar `.env.local`** (já está no gitignore)

**Verify**: testar via dashboard Vercel.

**Nota**: Esta task é manual do user. Posso ajudar lembrando os valores; não consigo modificar settings da Vercel sem credenciais que eu não tenho (token CLI funciona pra deploy mas não pra env vars com plain CLI — só via dashboard ou API).

---

### T12: Configurar Supabase — desligar self-signup + convite

**What**: No dashboard Supabase, desabilitar self-signup e enviar invite pro e-mail de teste.
**Where**: [Dashboard Supabase](https://supabase.com/dashboard/project/tmsaucxoeqpfluzwrwkc/auth/providers) + Users
**Depends on**: None

**Tools**: Dashboard manual.

**Done when**:
- [ ] Authentication → Providers → Email: "Confirm email" ON (default), e o providers config tá com sign-ups habilitados ou não — observação: `shouldCreateUser: false` na Server Action já bloqueia self-signup independentemente; o flag no dashboard é defesa em profundidade. Idealmente: Authentication → Sign In / Up → "Allow new users to sign up" OFF.
- [ ] Authentication → Users → "Add user" → digite `rafaelemeth@gmail.com` → "Send invitation". (Owner / e-mail de teste.)
- [ ] Recebido convite na caixa de e-mail (verifica spam se demorar).

**Nota**: Esta task é manual do user. Vou orientar com URLs específicas no momento da execução.

---

### T13: E2E test do fluxo completo

**What**: Validar que tudo funciona ponta a ponta — local primeiro, depois produção.
**Where**: Worktree local + URL de produção
**Depends on**: T1-T12

**Tools**:
- Bash (`npm run dev`)
- Browser manual (ou playwright skill se quiser automação)

**Done when**:
- [ ] **Local**:
  - [ ] `npm run dev` sobe sem erro
  - [ ] Visitar `http://localhost:3000` → redireciona pra `/login?redirectTo=/`
  - [ ] Digitar e-mail convidado → tela "Verifique seu e-mail em <email>"
  - [ ] Clicar link no e-mail → redireciona pra `/` autenticado, mostra `logado: <email>`
  - [ ] Clicar "sair" → volta pra `/login`
  - [ ] Digitar e-mail NÃO convidado → "Acesso não autorizado"
- [ ] **Produção** (após merge + deploy):
  - [ ] Mesmas validações em `https://delivery-os-phi.vercel.app`
  - [ ] Verificar que magic link no e-mail aponta pra `delivery-os-phi.vercel.app/auth/callback`, não `localhost`

**Verify**: navegação manual; opcional: invocar skill `playwright-skill` pra automação básica.

---

## Parallel Execution Map

```
Phase 1 (paralelo):
  ├── T1 (ActionResult)
  ├── T2 (auth/server.ts)  [depende lógicamente de T1]
  └── T3 (auth/client.ts)

Phase 2 (paralelo, após Phase 1):
  ├── T4 (proxy.ts)
  ├── T5 (actions/auth.ts)
  └── T6 (callback route)

Phase 3 (paralelo, após Phase 2):
  ├── T7 (login page)         [importa T8]
  ├── T8 (LoginForm)          [importa T5]
  ├── T9 (move page → (app))  [importa T2, T5]
  └── T10 (app layout)

Phase 4 (sequencial, após Phase 3):
  T11 (Vercel env) → T12 (Supabase config + invite) → T13 (E2E test)
```

Caminho crítico: T1 → T5 → T8 → T13. T11/T12 podem rodar em paralelo com T1-T10 (user-driven, em outra aba).

---

## Granularity Check

| Task | Scope | Status |
|---|---|---|
| T1 ActionResult | 1 arquivo, 4 exports | ✅ |
| T2 auth/server | 1 arquivo, 3 funções | ✅ |
| T3 auth/client | 1 arquivo, 1 hook | ✅ |
| T4 proxy | 1 arquivo | ✅ |
| T5 actions/auth | 1 arquivo, 2 actions | ✅ (coesivo) |
| T6 callback route | 1 arquivo, 1 handler | ✅ |
| T7 login page | 1 arquivo (server component) | ✅ |
| T8 LoginForm | 1 arquivo (client component) | ✅ |
| T9 move page | 2 arquivos (delete + create) | ✅ (coesivo) |
| T10 app layout | 1 arquivo | ✅ |
| T11 Vercel env | 1 ação manual | ✅ |
| T12 Supabase config | 2 ações manuais (sign-up off + invite) | ✅ (coesivo) |
| T13 E2E | 1 sessão de validação | ✅ |

---

## Tools Summary

| Task | Tools | Skills |
|---|---|---|
| T1 | Write | `dryos-conventions` |
| T2 | Write | `dryos-conventions` |
| T3 | Write | `dryos-conventions` |
| T4 | Write (consult Next 16 proxy.md) | `dryos-conventions` |
| T5 | Write | `dryos-conventions` |
| T6 | Write | `dryos-conventions` |
| T7 | Write | `dryos-design-system` |
| T8 | Write | `dryos-design-system` |
| T9 | Bash (`git mv`) + Edit | — |
| T10 | Write | — |
| T11 | User manual (Vercel dashboard) | — |
| T12 | User manual (Supabase dashboard) | — |
| T13 | Bash + browser (opt. `playwright-skill`) | — |

---

## Pre-Implementation Checklist

Antes de eu começar Phase 1:
1. **T11** (Vercel `NEXT_PUBLIC_APP_URL` setado) precisa estar feito **antes do deploy produção testar** — ok que essa task corre em paralelo? Eu te lembro no momento.
2. **T12** (Supabase invite pra `rafaelemeth@gmail.com` + desligar self-signup) precisa estar feito **antes do T13 testar**. Pode rodar em paralelo, mas convém antes do T13.
3. Posso seguir reto T1→T10 sem pausar? Ou pausa em cada Phase pra você revisar?
