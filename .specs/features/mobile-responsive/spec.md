# Feature: mobile-responsive

**Issue:** [#86](https://github.com/rafaelemeth/delivery_os/issues/86)
**Status:** SPEC
**Created:** 2026-05-27

---

## Objetivo

Tornar o DRYOS Studio navegável de verdade em telas pequenas (<640px) e médias (640-1024px), preservando o desktop. Padronizar os patterns no `dryos-design-system` SKILL pra "adoção padrão" — toda Lista nova já nasce responsiva, todo novo header já wrappa.

## Por que

Audit mostrou que o app é hoje **desktop-only**:
- Sidebar fixo 220px + main `ml-[220px]` come a tela inteira em <440px.
- Grids 12-col (`FrentesListSection`, `CostsTab`, `AllocationsSection`, `TaskListItem`) viram colunas micro-thin ilegíveis.
- Tabelas (`OperationsTable`, `ClientsTable`, `PersonsTable`) com 8+ colunas estouram horizontal sem overflow wrapper.

Membros vão acessar de celular (especialmente o Gabriel/Michel em campo). Sem mobile, o gating de operation-members fica útil só pro admin no laptop.

## Personas

- **Admin (mobile pontual):** abre o app no celular pra ver atenção/operação rápida no trânsito. Espera leitura sem zoom.
- **Member em campo (Gabriel/Michel):** principalmente celular. Espera Home → tabs → atenção → operação atribuída sem fricção.

## Decisões resolvidas (já fechadas no chat)

1. **Sidebar mobile = drawer slide-in** (hamburger no top-bar, backdrop, slide da esquerda).
2. **Tabelas mobile = card list** (abaixo de `md`, table some, cada linha vira card).
3. **Patterns canônicos no DS SKILL** — não basta aplicar, documentar pra evitar drift.
4. **3 PRs incrementais** (Shell → Lists & Tables → Polish).

## Requisitos funcionais

### RF1 — Layout shell (PR-A)
- Mobile top-bar exclusivo de `< md`: logo "DRYOS Studio" à esquerda + ícone hamburger à direita.
- Sidebar `hidden md:flex`.
- Main content: padding mobile + `md:ml-[220px]` (em vez de fixo).
- Drawer: posição `fixed inset-y-0 left-0 w-[260px]` slide-in via transform; backdrop `fixed inset-0 bg-ink/40` clicável pra fechar.
- Toggle do drawer via Client Component pequeno (`MobileShell` ou similar).
- ESC fecha drawer; ao navegar (Link), drawer fecha (via `useEffect` em pathname).

### RF2 — Lists responsivas (PR-B)
- Tabelas (`OperationsTable`, `ClientsTable`, `PersonsTable`): mantém `<table>` em `md:` e acima; abaixo renderiza `<ul>` de cards usando novo componente `MobileListItem`.
- `MobileListItem` aceita: title, subtitle?, pills?, meta?, href, trailing? (icon/action).
- Grids 12-col (`FrentesListSection`, `CostsTab`, `AllocationsSection`, `TaskListItem`): cada componente vira layout flex/stack abaixo de `md`. Headers da tabela viram pills/labels inline.

### RF3 — Polish (PR-C)
- `PageHeader.actions`: `flex flex-wrap items-center gap-2`.
- `HomeKpiStrip`: revisar `grid-cols-2` mobile (talvez 1 col em < 380px) e tamanho do número.
- `HomeSidebar`: em `md:lg:` (tablet) virar grid 2 col ao invés de stack vertical longo.
- `AddOperationMemberForm`: stack vertical abaixo de `md`.
- `TabsNav`: confirmar overflow-x funcionar bem com scrollbar discreta.

### RF4 — Patterns no SKILL
- Adicionar em `dryos-design-system/SKILL.md` seção "Mobile patterns":
  - **Shell**: drawer + top-bar canônico.
  - **Listas responsivas**: tabela em md+ ↔ MobileListItem em mobile.
  - **Grids responsivos**: regra "12-col só em md+; mobile = stack flex".
  - **PageHeader actions**: `flex-wrap` é padrão.
  - **Breakpoints**: confirmar `sm 640 / md 768 / lg 1024 / xl 1280` (Tailwind default).

## Não-objetivos

- ❌ PWA, service worker, app shell offline
- ❌ Touch gestures customizados (swipe pra abrir drawer etc) — só clique
- ❌ Refator de DS pra system inteiro (só ajustes responsivos)
- ❌ Novas features ou rotas
- ❌ `/public/[token]` (já mobile-friendly por design)

## Critérios de aceite

- [ ] Em iPhone SE (375px) Home, Operations, Operation detail, Clients, Persons navegáveis sem scroll horizontal
- [ ] Drawer abre/fecha (hamburger, backdrop, ESC, navegação)
- [ ] Listas em mobile mostram cards legíveis, não tabela
- [ ] Em tablet (768-1024) layout adequado (sidebar ainda visível, sem cards mobile)
- [ ] Build + typecheck verde, zero console error
- [ ] DS SKILL com seção "Mobile patterns" canônica

## Decisões pra Design

- **D1:** Drawer com `<dialog>` element ou div + Portal? `<dialog>` tem ESC + backdrop nativo, mas styling tricky com Tailwind 4. Provavelmente div + state via Client Component.
- **D2:** `MobileListItem` é Server Component (puro layout) ou Client (precisa de algum estado)? Provavelmente Server — recebe href + slots.
- **D3:** Top-bar mobile mostra título da página ou só logo? Logo mais simples e não precisa ler pathname.
- **D4:** Drawer encosta no top (some o top-bar dentro do drawer) ou abaixo (top-bar visível)? Convenção mais comum: drawer encosta no top, com X interno pra fechar.
