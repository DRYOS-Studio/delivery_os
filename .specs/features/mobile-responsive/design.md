# Design: mobile-responsive

**Spec:** [spec.md](./spec.md) · **Issue:** [#86](https://github.com/rafaelemeth/delivery_os/issues/86)
**Status:** DESIGN

---

## Decisões resolvidas

| ID | Decisão | Por quê |
|---|---|---|
| **D1** | Drawer = div + state Client Component (`MobileShell`) | Controle total de styling/animação; `<dialog>` traz comportamentos default conflitantes com layout custom. |
| **D2** | `MobileListItem` = Server Component puro | Sem estado; recebe href + slots; renderiza `<li><Link/></li>`. |
| **D3** | Top-bar mobile = só logo "DRYOS Studio" + hamburger | Menos ruído; título da página fica no `PageHeader` abaixo. |
| **D4** | Drawer cobre top-bar inteiro, X interno | Pattern nativo (Material/iOS); usuário sabe que `X` fecha. |

Breakpoints: Tailwind default (`sm 640 / md 768 / lg 1024 / xl 1280 / 2xl 1536`). **Decisão estratégica:** `md` (768px) é a fronteira mobile/desktop pro shell (drawer aparece, tabelas viram cards).

---

## PR-A — Layout shell

### Arquivos novos

**`src/components/layout/MobileShell.tsx`** (Client Component)

```tsx
"use client";
import { Menu, X } from "lucide-react";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils/cn";

type Props = { sidebar: React.ReactNode; children: React.ReactNode };

export function MobileShell({ sidebar, children }: Props) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  // Fecha ao navegar
  useEffect(() => { setOpen(false); }, [pathname]);

  // ESC fecha
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  // Trava scroll do body quando aberto
  useEffect(() => {
    if (open) document.body.style.overflow = "hidden";
    else document.body.style.overflow = "";
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  return (
    <div className="min-h-screen">
      {/* Mobile top-bar — visível só < md */}
      <header className="md:hidden sticky top-0 z-30 flex items-center justify-between h-14 px-4 bg-surface border-b border-line">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-sm bg-ink text-bg flex items-center justify-center font-display font-semibold text-xs">D</div>
          <span className="font-display text-sm text-ink font-semibold">DRYOS Studio</span>
        </div>
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Abrir menu"
          className="text-ink hover:text-oak transition-colors p-2 -mr-2"
        >
          <Menu className="w-5 h-5" strokeWidth={1.75} />
        </button>
      </header>

      {/* Sidebar desktop (fixed) — visível md+ */}
      <div className="hidden md:block">
        <div className="fixed left-0 top-0 h-screen w-[220px] z-20">
          {sidebar}
        </div>
      </div>

      {/* Drawer mobile — só < md */}
      <div
        className={cn(
          "md:hidden fixed inset-0 z-40",
          open ? "pointer-events-auto" : "pointer-events-none",
        )}
        aria-hidden={!open}
      >
        {/* Backdrop */}
        <div
          className={cn(
            "absolute inset-0 bg-ink/40 transition-opacity duration-200",
            open ? "opacity-100" : "opacity-0",
          )}
          onClick={() => setOpen(false)}
        />
        {/* Painel */}
        <aside
          className={cn(
            "absolute inset-y-0 left-0 w-[260px] bg-surface shadow-xl transition-transform duration-200",
            open ? "translate-x-0" : "-translate-x-full",
          )}
        >
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="Fechar menu"
            className="absolute top-3 right-3 text-mute hover:text-ink transition-colors p-2 z-10"
          >
            <X className="w-5 h-5" strokeWidth={1.75} />
          </button>
          {sidebar}
        </aside>
      </div>

      <main className="md:ml-[220px] max-w-[1280px] p-4 md:p-7">{children}</main>
    </div>
  );
}
```

### Arquivos modificados

**`src/app/(app)/layout.tsx`** — passa Sidebar pra MobileShell:
```tsx
import { MobileShell } from "@/components/layout/MobileShell";
import { Sidebar } from "@/components/layout/Sidebar";

export default async function AppLayout({ children }) {
  return <MobileShell sidebar={<Sidebar />}>{children}</MobileShell>;
}
```

**`src/components/layout/Sidebar.tsx`** — remover `fixed left-0 top-0 h-screen w-[220px]` (posicionamento agora é responsabilidade do wrapper). Sidebar fica como **componente de conteúdo** com `h-full w-full flex flex-col bg-surface border-r border-line p-5`. Ambos os contextos (desktop fixed wrapper e mobile drawer) aplicam o tamanho.

### Layout viewport

Confirmar `app/layout.tsx` (root) tem `<meta name="viewport" content="width=device-width, initial-scale=1" />` — Next 16 já injeta isso no `<head>` automaticamente via `viewport` export. Adicionar export se faltar.

---

## PR-B — Lists & tables responsivas

### Componente novo: `MobileListItem`

**`src/components/ui/MobileListItem.tsx`** (Server)

```tsx
import Link from "next/link";
import { ChevronRight } from "lucide-react";

type Props = {
  href: string;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  pills?: React.ReactNode;  // slot pra pills (status, linha, etc.)
  meta?: React.ReactNode;   // slot pra metadados secundários (data, contagem)
  trailingValue?: React.ReactNode; // valor à direita (MRR pra admin, etc.)
};

export function MobileListItem({ href, title, subtitle, pills, meta, trailingValue }: Props) {
  return (
    <li>
      <Link
        href={href}
        className="flex items-center gap-3 px-4 py-3 border-b border-line last:border-b-0 hover:bg-surface transition-colors"
      >
        <div className="flex-1 min-w-0">
          <div className="font-medium text-ink truncate">{title}</div>
          {subtitle && <div className="font-mono text-[10px] text-mute mt-0.5">{subtitle}</div>}
          {pills && <div className="flex flex-wrap items-center gap-1.5 mt-1.5">{pills}</div>}
          {meta && <div className="font-mono text-[10px] text-mute mt-1">{meta}</div>}
        </div>
        {trailingValue && <div className="font-mono text-xs text-mute">{trailingValue}</div>}
        <ChevronRight className="w-4 h-4 text-mute shrink-0" strokeWidth={1.75} />
      </Link>
    </li>
  );
}
```

### Pattern de Table responsiva

Cada tabela `OperationsTable`, `ClientsTable`, `PersonsTable`:

```tsx
return (
  <>
    {/* Desktop: table */}
    <div className="hidden md:block bg-card border border-line rounded shadow-sm overflow-hidden">
      <table className="w-full text-sm">...</table>
    </div>
    {/* Mobile: card list */}
    <ul className="md:hidden bg-card border border-line rounded shadow-sm overflow-hidden">
      {items.map(item => (
        <MobileListItem
          key={item.id}
          href={`/operations/${item.id}`}
          title={item.name}
          subtitle={`${item.clientName} · ${item.clientSlug}`}
          pills={<><Pill variant="oak" showDot>{linha}</Pill><Pill variant={statusVariant}>{status}</Pill></>}
          meta={`${item.activeFrentes} frente${item.activeFrentes===1?"":"s"} · ${formatDateBR(item.createdAt)}`}
          {...(isAdmin ? { trailingValue: formatMoneyBR(item.monthlyRecurringRevenue) } : {})}
        />
      ))}
    </ul>
  </>
);
```

### Grids 12-col (FrentesListSection, CostsTab, AllocationsSection, TaskListItem)

Pattern canônico:
- Mobile: `flex flex-col gap-2` no item; labels viram inline com valor; metadados em pills.
- Desktop (`md:`): mantém `grid grid-cols-12 gap-3` atual.

Pattern simplificado:
```tsx
<div className="flex flex-col gap-1 md:grid md:grid-cols-12 md:gap-3 md:items-center px-4 py-3 border-b border-line">
  <div className="md:col-span-3 font-medium text-ink truncate">{title}</div>
  <div className="md:col-span-2 flex items-center gap-2">
    <span className="md:hidden font-mono text-[10px] text-mute uppercase tracking-wide">Status:</span>
    <Pill>{status}</Pill>
  </div>
  ...
</div>
```

Headers da tabela (linha de títulos) ficam `hidden md:grid`.

---

## PR-C — Polish

### `PageHeader.tsx`
```tsx
<div className="flex flex-wrap items-center gap-2">...{actions}</div>
```

### `HomeKpiStrip.tsx`
- Em `< xs` (estimativa: <380px via `@container`) reduzir o `text-3xl` do número, ou trocar pra 1 coluna.
- Decisão pragmática: deixar `grid-cols-2` (já tá; iPhone SE 375px serve), mas reduzir padding interno do `MetricCard` se virar dor (passar `size="sm"` se existir, senão deixar).

### `HomeSidebar.tsx`
- No tablet (md-lg), em vez de `flex-col` longo, virar `grid md:grid-cols-2 xl:grid-cols-1`. Vilões + Quick Wins lado a lado.

### `AddOperationMemberForm.tsx`
- `flex flex-col md:flex-row md:items-end gap-3` (vez de wrap).

### `TabsNav.tsx`
- Confirmar `overflow-x-auto`. Adicionar `snap-x snap-mandatory` + `snap-start` em cada tab pra "click to snap".

### `OperationsGrid.tsx` (já existente)
- Conferir que o `grid-cols-1 2xl:grid-cols-2` quebra bem no mobile da coluna principal estreita.

---

## Patterns canônicos no DS SKILL

Adicionar seção **"Mobile patterns"** em `.claude/skills/dryos-design-system/SKILL.md`:

```markdown
## Mobile patterns

### Breakpoints
Tailwind default: `sm 640 / md 768 / lg 1024 / xl 1280 / 2xl 1536`. Mobile-first.
Fronteira mobile/desktop pro shell: `md` (768px).

### Shell — drawer pattern
- Sidebar desktop: `hidden md:block` no wrapper externo (posicionamento fixed).
- Top-bar mobile: `md:hidden sticky top-0` — logo + hamburger.
- Drawer mobile: `md:hidden fixed inset-0 z-40` com backdrop `bg-ink/40` + painel `inset-y-0 left-0 w-[260px]` slide via translate-x; X interno + ESC + click-outside fecham; fecha ao navegar via usePathname.
- Main content: `md:ml-[220px] p-4 md:p-7`.

### Listas responsivas
Padrão: **tabela em `md:` ↔ `MobileListItem` em mobile**.

```tsx
<>
  <div className="hidden md:block"><table>...</table></div>
  <ul className="md:hidden">{items.map(i => <MobileListItem ... />)}</ul>
</>
```

`MobileListItem` slots: `href` (obrigatório), `title`, `subtitle?`, `pills?`, `meta?`, `trailingValue?`.

### Grids responsivos
- 12-col só em `md:` e acima. Mobile = `flex flex-col gap-2` no item.
- Labels que viram pills inline no mobile.
- Headers de "tabela" (linha de títulos) ficam `hidden md:grid`.

### PageHeader actions
Padrão: `flex flex-wrap items-center gap-2`. Sem `flex-nowrap`.
```

---

## Plano de fases

3 PRs (já decidido):

| PR | Escopo | Estimativa |
|---|---|---|
| **PR-A** | MobileShell + Sidebar refactor + layout.tsx + DS Mobile shell pattern | ~2h |
| **PR-B** | MobileListItem + 3 tables + 4 grids 12-col + DS lista responsiva pattern | ~3h |
| **PR-C** | Polish 5 items + DS polish notes + STATE update + Closes #86 | ~1.5h |

---

## Riscos

- **R1 — Sidebar refactor quebra desktop:** Mover `fixed/h-screen/w-[220px]` do Sidebar pro MobileShell. Confirmar que o sidebar continua scroll-correct e altura completa. Mitigação: testar logo após implementação.
- **R2 — Hidratação client/server:** `MobileShell` é Client mas recebe Sidebar (Server) como `sidebar` prop. Funciona em Next 16, mas attention pra não acidentalmente importar Sidebar dentro do Client component.
- **R3 — Tabelas com 8+ colunas no mobile:** Card list precisa priorizar info. Triagem por tabela faz parte do PR-B (decidir o que vai em title vs subtitle vs pills vs meta).
- **R4 — Performance da reidratação:** drawer é pequeno, sem custo perceptível.

## Validação manual

Pós PR-A: redimensionar Vercel preview pra 375px (DevTools) — drawer abre/fecha; ESC fecha; click backdrop fecha; navegação fecha; main não tem scroll horizontal.
Pós PR-B: cada lista (Ops/Clients/Persons) renderiza card list em <768px. Os 4 grids 12-col stack legível.
Pós PR-C: PageHeader actions wrappam; KPI strip legível em 375px; tabs scrollam suave.
