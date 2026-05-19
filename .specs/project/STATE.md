# State

**Last Updated:** 2026-05-19
**Current Work:** `link-publico-narrativa` — COMPLETE (issue #67). 6 seções do mockup renderizadas no `/public/[token]` aba Visão; narrativa por vilão versionada por mês via `operation_villain_narratives`. Próximos: fila do `catalog-admin` (issues #64, #65, #66) + integrações n8n + dark-mode + polish-migration.

---

## Recent Decisions (Last 60 days)

### AD-001: Skills movidas pra `.claude/skills/<name>/SKILL.md` (2026-05-15)

**Decision:** `dryos-conventions-SKILL.md` e `dryos-design-system-SKILL.md` movidos da raiz pros caminhos canônicos do CLAUDE.md (`.claude/skills/dryos-conventions/SKILL.md`, `.claude/skills/dryos-design-system/SKILL.md`).
**Reason:** Alinhar com referência do CLAUDE.md e permitir descoberta automática do agente.
**Trade-off:** Histórico git tem rename, mas mantém continuidade via `git log --follow`.
**Impact:** Skills passam a ser carregadas automaticamente quando o pattern bater.

### AD-002: CLAUDE.md expandido com 8 blocos da Casa Financeira (2026-05-15)

**Decision:** Trazidos pro DRYOS, com adaptação de razões/conteúdo: `tlc-spec-driven` obrigatório antes de code change; Invariantes de implementação (14 regras duras); Server Actions com `ActionResult<T>`; Migration conventions detalhadas; Antes de criar tabela (checklist 3 buscas); Issue antes de PR; Documentação como contrato; MCP tools listados.
**Reason:** Mesmas dores do outro projeto (17+ entidades, regras sutis, RLS universal). Padrões maduros valem trazer com adaptação, não verbatim.
**Trade-off:** CLAUDE.md cresceu de 186 → 404 linhas; ainda dentro de margem útil. Cerimônia maior por mudança de código (tlc-spec-driven obrigatório), aceito pelo usuário.
**Impact:** Toda mudança de código agora abre com `Skill: tlc-spec-driven`. Schema obrigado a `COMMENT ON TABLE` + RLS + FK nomeada na mesma migration.

### AD-009: Adiar `bitwarden-integration` pra v2 (2026-05-15)

**Decision:** Tirar a feature `bitwarden-integration` do escopo da semana 1. Tabela `credentials` (que apontaria pro Bitwarden) também sai do MVP — entra junto quando o cofre real for definido.
**Reason:** Bitwarden Teams (US$ 4/usuário/mês) é custo evitável no estágio atual. Decisão 03 do PRD já antecipou: "Vaultwarden self-host fica como alternativa pra v2 se mensalidade incomodar." Princípio 01 ("sistema é mapa, não cofre") permanece intacto — apenas pula a integração inicial.
**Trade-off:** Operação aberta vai ter aba/seção "Credenciais" vazia ou hidden até v2. Quando voltar: avaliar Bitwarden Free pessoal (só solo), Vaultwarden self-host (precisa VPS), ou Bitwarden Teams (pagar).
**Impact:** Cronograma sem 1 reduzido a `week-01-setup` ✅ + `auth`. ROADMAP atualizado movendo `bitwarden-integration` pra Future Considerations. CLAUDE.md mantém o princípio mas linha "Cofre senhas | Bitwarden Teams" do stack table fica como aspiração não-imediata.

### AD-008: Vercel deploy live em delivery-os-phi.vercel.app (2026-05-15)

**Decision:** Deploy de produção via integração GitHub→Vercel; trigger automático em push pra `main`. Projeto Vercel `delivery-os` em `rafaelemeths-projects` (team Pro), Node 24.x. Alias produção: `delivery-os-phi.vercel.app`.
**Reason:** Cumpre item de validação do PR #2 (run em URL pública); habilita demo + smoke test E2E daqui em diante.
**Trade-off:** **Gotcha encontrada e corrigida**: quando o projeto foi importado no dashboard, `main` ainda só tinha docs (sem `package.json`). Vercel salvou `framework: null` no projeto. Mesmo após o merge do PR #2 com o app Next.js completo, o framework continuou `null` → todos os paths retornavam 404 (até `/favicon.ico`), mesmo com build verde. Fix: dashboard → Project Settings → Framework Preset → **Next.js** → Save → Redeploy. **Lição**: importar projeto Vercel ANTES do `main` ter código quebra detecção.
**Impact:** Build atual 6s (Turbopack), TTFB 65ms (CDN edge gru1), HTML 8077b. Pending: `NEXT_PUBLIC_APP_URL` nas envs da Vercel ainda em branco — preencher com `https://delivery-os-phi.vercel.app` na próxima sessão antes de habilitar link público.

### AD-007: Pivot pra Supabase remoto (projeto `Delivery OS` `tmsaucxoeqpfluzwrwkc`) (2026-05-15)

**Decision:** Usar projeto remoto `Delivery OS` (criado pelo usuário no dashboard, org Altis Lisboa, região `us-east-2`, Postgres 17.6.1.121) em vez de local Docker (B-002). Migration aplicada via MCP. Types regenerados via MCP. `gen:types` script atualizado pra `--project-id tmsaucxoeqpfluzwrwkc`.
**Reason:** Docker Desktop quebrou (`unable to start`, I/O error ao baixar image). Pivot pro remoto desbloqueou imediatamente; e remoto vai precisar existir mesmo pra deploy futuro.
**Trade-off:** Schema testes (T9b) rodam contra DB de produção (sem branch/clone). Pra dev mais agressivo (refactor de schema), considerar Supabase branches (`create_branch` MCP) na sem 2+. Região `us-east-2` (não `sa-east-1` como a `Radar Altis`) — latência levemente maior pro BR, aceito.
**Impact:** `.env.local.example` aponta pro URL real (`tmsaucxoeqpfluzwrwkc.supabase.co`). Cliente Supabase (`src/lib/db/client.ts`) lê de env vars. Migration `20260515000001_initial_schema.sql` aplicada com `success: true`. Bateria de invariantes 5/5 OK_rejected. Types gerados em `src/lib/db/types.ts`.

### AD-006: Manter `AGENTS.md` gerado pelo create-next-app (2026-05-15)

**Decision:** Manter o `AGENTS.md` gerado pelo bootstrap (1 bloco curto avisando "This is NOT the Next.js you know — read node_modules/next/dist/docs/"). Sobrescrever apenas o `CLAUDE.md` mínimo gerado pelo `@AGENTS.md`; o nosso (404 linhas) prevalece.
**Reason:** Aviso do framework é válido — Next 16 tem breaking changes. Vou consultar `node_modules/next/dist/docs/` antes de escrever código Next sensível a versão (routing, fetching, caching).
**Trade-off:** Mais 1 arquivo na raiz pra checar; trivial.
**Impact:** Antes de tarefas com APIs Next sensíveis, ler `node_modules/next/dist/docs/`. CLAUDE.md custom mantido.

### AD-005: Aceitar Next.js 16 + Tailwind 4 (em vez de 15 + 3) (2026-05-15)

**Decision:** Bootstrap com versões current (Next 16.2.6, Tailwind 4) em vez de pinar 15 + 3. Skill `dryos-design-system` adaptada: tokens viram bloco `@theme inline { ... }` em `globals.css` em vez de `tailwind.config.ts`.
**Reason:** create-next-app@latest entrega 16 + 4. Pinar versões antigas só pra casar com snippet desatualizado de skill é dívida invertida. Tailwind 4 CSS-first é mais limpo. Risco de breaking change em Next 16 é mitigado por consultar `node_modules/next/dist/docs/`.
**Trade-off:** Skill `dryos-design-system` precisou ser revisada (seção "Tailwind config" → "@theme block"). Task T5 do week-01-setup foi merged com T4 (um arquivo: `globals.css` com vars + `@theme`).
**Impact:** Sem `tailwind.config.ts` na raiz. Adicionar token novo = adicionar linha em `:root` + linha em `@theme inline`. Documentação atualizada no mesmo commit (regra "documentação como contrato").

### AD-004: Supabase local via Docker pro desenvolvimento da semana 1 (2026-05-15)

**Decision:** `supabase init && supabase start` no worktree. Migration aplicada localmente via `supabase db reset` ou `supabase migration up`. Types gerados via CLI local. Decisão de projeto remoto adiada.
**Reason:** Autônomo, não bloqueia. Mais rápido pra iterar. Sem custo de criar projeto Supabase ainda na fase de bootstrap.
**Trade-off:** Antes de fazer deploy, vai precisar de projeto remoto (criar via MCP ou usar existente).
**Impact:** T9/T10 da week-01-setup rodam local; instalação do Supabase CLI vira pré-req (Bash detecta e instala se necessário). Adiciona Docker como dependência implícita do ambiente dev.

### AD-003: Schema dedicado vs `public` no Supabase — usar `public` (2026-05-15)

**Decision:** DRYOS usa `public`. Projeto Supabase é dedicado, não compartilhado com outros apps.
**Reason:** Sem necessidade de isolamento de schema (não há outros apps no mesmo projeto). Casa Financeira usa `casa_financeira` porque divide projeto com Radar Altis — não é o caso aqui.
**Trade-off:** Se um dia precisar dividir o projeto Supabase com outro app, teremos que migrar tudo pra um schema dedicado. Risco baixo.
**Impact:** Migrations qualificam tabelas como `public.<nome>` (default). Sem helper `cf(supabase)`.

---

## Active Blockers

_None._

## Resolved Blockers

### B-002: Docker Desktop unable to start ✅ RESOLVED 2026-05-15

**Discovered:** 2026-05-15 durante T9 (apply local migration).
**Impact:** `supabase start` falhou ao baixar image do Postgres (I/O error + Docker Desktop unable to start). Bloqueou T9/T10/T11.
**Resolution:** Pivot pra Supabase remoto (AD-007). Migration aplicada via MCP `apply_migration` no projeto `Delivery OS` (`tmsaucxoeqpfluzwrwkc`). Types gerados via MCP `generate_typescript_types`. Docker não é mais dependência do fluxo de dev/setup (pode virar relevante de novo em sem 2 se a gente quiser branch isolada local).

### B-001: Supabase MCP — projeto-alvo não definido ✅ RESOLVED 2026-05-15

**Discovered:** 2026-05-15
**Resolution:** Optou-se por **Supabase local via Docker** (`supabase init && supabase start`). Decisão de projeto remoto (deploy) fica pra mais tarde. T9/T10 da week-01-setup usam o local stack.

---

## Lessons Learned

### L-003: `useTransition` deixa `isPending` preso após `router.push` em forms (2026-05-16)

**Context:** OperationForm e ClientForm usavam `useTransition` pra rastrear estado de submit. Padrão era: `startTransition(async () => { const result = await action(...); if (result.ok) router.push(...) })`.
**Problem:** Quando o action retornava OK e a gente chamava `router.push + router.refresh`, `isPending` permanecia `true` indefinidamente — botão ficava "Salvando..." mesmo depois do save ter funcionado e os dados terem sido persistidos. Comportamento inconsistente do `useTransition` no Next 16 + App Router quando o callback da transição dispara navegação.
**Solution:** Trocar `useTransition` pelo `formState.isSubmitting` do react-hook-form. Esse flag é `true` durante o handler async e volta a `false` quando o handler retorna — independente do que o router faça depois. Pro botão Arquivar (não-RHF), state local `isArchiving`. Variável `busy = isSubmitting || isArchiving` cobre os disabled dos inputs. Bug fix em PR #16.
**Prevents:** Forms novos devem seguir o pattern em `.claude/skills/dryos-conventions/SKILL.md` seção "Forms". Não usar `useTransition` pra wrapping de submit que vai navegar depois.

### L-002: Importar projeto Vercel antes do `main` ter código quebra detecção de framework (2026-05-15)

**Context:** Setup do Vercel feito pelo dashboard ANTES do PR #2 ser merged. Naquele momento `main` só tinha docs (CLAUDE.md, PRD, mockup, README), sem `package.json`.
**Problem:** Vercel detectou framework como `null` e salvou no projeto. Mesmo após o merge incluir `package.json` + `src/app/`, framework continuou null → 404 em todos os paths, mesmo com build verde.
**Solution:** Dashboard → Project Settings → Framework Preset → **Next.js** → Save → Redeploy. Aí TTFB caiu pra 65ms e `/` virou 200.
**Prevents:** Em deploys futuros: garantir que `main` já tem o framework no momento do import OU, no dashboard, escolher manualmente o Framework Preset durante o import (não confiar 100% em autodetect).

### L-001: Worktree de Claude Code parte do commit inicial (2026-05-15)

**Context:** Worktree foi criada antes do commit "Setup" entrar em main; arquivos canônicos (CLAUDE.md, SETUP.md, PRD, mockup) ficaram fora do estado inicial.
**Problem:** Primeira investigação reportou repo vazio, gastando turn de descoberta.
**Solution:** Olhar parent repo + `git log --all` revelou commits em main não trazidos pra branch da worktree. `git merge main --no-edit` resolve fast-forward.
**Prevents:** Em próxima worktree, checar `git log --all --oneline` ANTES de assumir que o repo está vazio.

---

## Preferences

**Model Guidance Shown:** never
