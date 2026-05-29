# Tasks: mobile-responsive

**Spec:** [spec.md](./spec.md) · **Design:** [design.md](./design.md) · **Issue:** [#86](https://github.com/rafaelemeth/delivery_os/issues/86)

3 PRs já planejados. Tarefas detalhadas pro PR-A; PR-B e PR-C como esboço.

---

## PR-A — Layout shell (mobile drawer)

**Branch:** `feat/mobile-shell` · **PR body:** `Refs #86`

### A1 — Refatorar `Sidebar.tsx`
- Remover `fixed left-0 top-0 h-screen w-[220px]` da `<aside>` raiz.
- Substituir por `h-full w-full flex flex-col bg-surface border-r border-line p-5` (posicionamento agora é do wrapper).
- **Verificação:** Sidebar isolada funciona como componente puro.

### A2 — Criar `MobileShell.tsx` (Client)
- `src/components/layout/MobileShell.tsx` conforme design.md.
- Estado `open`, ESC, click backdrop, navegação (`usePathname`), trava scroll body, transform slide.
- Mobile top-bar (`md:hidden sticky`) com logo + hamburger.
- Desktop sidebar wrapper (`hidden md:block`) com posicionamento fixed.
- **Verificação:** typecheck + render local.

### A3 — Atualizar `layout.tsx`
- `<MobileShell sidebar={<Sidebar />}>{children}</MobileShell>` substituindo a estrutura atual.
- **Verificação:** typecheck.

### A4 — Documentar pattern no SKILL
- Seção "Mobile patterns" → subseção "Shell — drawer pattern" em `.claude/skills/dryos-design-system/SKILL.md`.
- Mencionar breakpoints + posicionamento + comportamentos do drawer.
- **Verificação:** doc render no preview do SKILL.

### A5 — Smoke + PR-A
- Build + typecheck verde.
- Commit, push, `gh pr create` com `Refs #86`.
- Validação Vercel preview em 375px: drawer abre/fecha; navega fecha; ESC fecha; click-outside fecha; main sem horizontal scroll.

---

## PR-B — Lists responsivas · esboço

**Branch:** `feat/mobile-lists` · `Refs #86`

- **B1:** Criar `src/components/ui/MobileListItem.tsx` (Server).
- **B2:** Refatorar `OperationsTable` — table desktop + ul cards mobile.
- **B3:** Refatorar `ClientsTable` — idem.
- **B4:** Refatorar `PersonsTable` — idem.
- **B5:** Refatorar `FrentesListSection` (12-col grid → stack mobile).
- **B6:** Refatorar `CostsTab` (grids 12-col).
- **B7:** Refatorar `AllocationsSection`.
- **B8:** Refatorar `TaskListItem`.
- **B9:** DS SKILL — subseção "Listas responsivas" + "Grids responsivos".
- **B10:** Smoke + PR-B.

---

## PR-C — Polish · esboço

**Branch:** `feat/mobile-polish` · `Closes #86`

- **C1:** `PageHeader` actions `flex-wrap`.
- **C2:** `HomeKpiStrip` densidade mobile.
- **C3:** `HomeSidebar` tablet (md-lg grid 2-col).
- **C4:** `AddOperationMemberForm` stack vertical mobile.
- **C5:** `TabsNav` snap-points.
- **C6:** STATE.md + ROADMAP bônus.
- **C7:** DS SKILL "PageHeader actions" + finalizar seção.
- **C8:** Smoke + PR-C.

---

## DoD (feature)

- [ ] iPhone SE 375px: Home/Ops/Clients/Persons/Detail navegáveis sem zoom horizontal
- [ ] Drawer com 4 fechamentos (X, ESC, backdrop, navegação)
- [ ] Tables viraram cards em mobile
- [ ] Grids 12-col stackam em mobile
- [ ] PageHeader actions wrappam
- [ ] DS SKILL com seção "Mobile patterns" completa
- [ ] #86 fechada via PR-C
