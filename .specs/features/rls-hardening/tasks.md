# RLS Hardening — Tasks

> Design: `./design.md` (gate ✅). Issue: #127. Branch: `feat/rls-hardening`.

## T1 — Probe de privilégio em storage.objects (D11)
Rodar via `execute_sql`: `CREATE POLICY _probe ON storage.objects FOR SELECT TO authenticated USING (false); DROP POLICY IF EXISTS _probe ON storage.objects;`
**Verificação:** resultado registrado (passou → idempotência via execute_sql; 42501 → idempotência via 2º apply_migration). Sem estado residual (`_probe` não existe em pg_policies).

## T2 — Escrever migration `supabase/migrations/20260611<HHMMSS>_rls_hardening.sql`
Ordem das seções (D10): catálogos → search_path → anon/rls_auto_enable → storage. CASE-expr do D2 nas 3 policies de storage; corpo de `rls_auto_enable` byte-exato do apêndice; REVOKEs do D9; `ALTER DEFAULT PRIVILEGES` do D7.
**Verificação:** todo DROP é `IF EXISTS`; nenhum cast `::uuid` fora de CASE-guard; `SET search_path TO 'pg_catalog'` no rls_auto_enable (não `public`); 9 REVOKEs de anon + 2 de authenticated; event trigger dentro de `DO $$` com guard de existência + EXCEPTION insufficient_privilege.

## T3 — Aplicar e re-aplicar (idempotência)
`apply_migration` → depois re-run conforme T1.
**Verificação:** ambas execuções sem erro; `pg_policies` mostra 3 policies novas de storage (velhas ausentes), 3+3+2 policies de catálogo conforme D5.

## T4 — Testes de bypass (membro e admin simulados)
Via `execute_sql` em transação: `SET LOCAL ROLE authenticated` + `set_config('request.jwt.claims', ...)` com sub de um profile member (e depois admin).
**Verificação (observáveis por comando):** storage SELECT/DELETE cross-op → 0 rows; INSERT cross-op → 42501; próprio prefixo → passa; catálogos UPDATE/DELETE membro → 0 rows, INSERT → 42501; admin UPDATE passa, DELETE → 0 rows; row `garbage/x.txt` seedada como postgres → SELECT membro E admin 0 rows sem erro de cast → cleanup.

## T5 — Advisors + funções
`get_advisors` security e performance; queries em `proconfig`/`has_function_privilege`.
**Verificação:** zero `rls_policy_always_true`, `function_search_path_mutable`, `anon_security_definer_function_executable`; residual `authenticated_security_definer...` = 7; `proconfig` com search_path nas 6; `has_function_privilege('anon', fn)` false nas 9 e `('authenticated', fn)` false nas 2 do D9; performance sem lint novo.

## T6 — Smoke no app (produção Vercel — migration já vale pro banco de prod)
Upload + download de anexo como membro; editar item de catálogo como admin; criar quick win com impacto (trigger síncrono).
**Verificação:** 3 fluxos OK. Se browser MCP indisponível, hand-off explícito pro usuário validar E2E (registrar no PR).

## T7 — Docs no mesmo branch
`docs/DATABASE_SCHEMA.md` (nota policies de storage + data); `.claude/skills/dryos-conventions/SKILL.md` (convenção D7: função nova sem EXECUTE de anon); `.specs/project/STATE.md` (AD-015 + estado).
**Verificação:** 3 arquivos atualizados; AD-015 cita D1–D11 resumidos.

## T8 — PR
Branch `feat/rls-hardening`, commit (imperativo, en), PR com `Closes #127` + docs alterados listados; gate `/code-review` no diff.
**Verificação:** PR aberto, review sem finding de correção pendente.

---
**Gate Fase 3 (auto-revisão):** cada task tem critério observável; dependências lineares T1→T8 (T4–T6 dependem de T3; T7 independente após T3; T2 depende de T1 só pra documentar o caminho de idempotência — pode rodar em paralelo). Atômicas: T2 é 1 arquivo, T3–T5 são verificações puras, T7 são 3 edits de doc. ✅
