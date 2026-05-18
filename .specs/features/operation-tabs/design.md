# operation-tabs Design

**Spec**: `.specs/features/operation-tabs/spec.md`

---

## Architecture Overview

Componente UI primitive `TabsNav` (client) + page-level config. Page server lê `searchParams.tab`, normaliza, e renderiza condicionalmente apenas a section da tab ativa. Hero permanece persistente acima das tabs. Mesma estrutura espelhada em `/public/[token]` com config reduzida.

```mermaid
graph TD
    Page["/operations/[id] page"] -- normalizeTab --> Tab[TabKey]
    Page --> Hero[OperationHero]
    Page --> TabsNav["TabsNav (client)"]
    TabsNav -- Link prefetch --> URL["?tab=<key>"]
    Page -- conditional render --> Section[OperationVillains+QW | Frentes | Briefing | ...]
    PublicPage["/public/[token] page"] -- normalizeTab --> PTab[PublicTabKey]
    PublicPage --> PublicTabsNav[TabsNav]
    PublicPage -- conditional --> PublicSection[PublicVillains+Achievements | PublicFrentes | PublicAttachments | PublicSLA]
```

---

## Code Reuse

| What | How |
|---|---|
| Sections existentes | Mantidas intactas, só agrupadas dentro do switch |
| `Pill` | Count nas tab labels |
| `Link` (next/navigation) | Tab nav com `prefetch=true` |
| Promise.all atual | Inalterado — dados sempre carregam todos pra contagens |

---

## Component: `TabsNav` (novo, ui primitive)

`src/components/ui/TabsNav.tsx` — client component reutilizável.

```tsx
"use client";

import Link from "next/link";
import { Pill } from "@/components/ui/Pill";
import { cn } from "@/lib/utils/cn";

export type TabDef<K extends string = string> = {
  key: K;
  label: string;
  count?: number;
};

type Props<K extends string> = {
  tabs: ReadonlyArray<TabDef<K>>;
  activeTab: K;
  basePath: string;
  searchParamName?: string; // default "tab"
};

export function TabsNav<K extends string>({
  tabs,
  activeTab,
  basePath,
  searchParamName = "tab",
}: Props<K>) {
  return (
    <nav className="sticky top-0 z-10 bg-bg border-b border-line mb-6">
      <div className="flex gap-1 overflow-x-auto -mb-px">
        {tabs.map((t) => {
          const isActive = t.key === activeTab;
          const href = `${basePath}?${searchParamName}=${t.key}`;
          const display = t.count !== undefined && t.count > 99 ? "99+" : t.count;
          return (
            <Link
              key={t.key}
              href={href}
              prefetch
              scroll={false}
              className={cn(
                "inline-flex items-center gap-2 px-3 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 transition-colors",
                isActive
                  ? "border-ink text-ink"
                  : "border-transparent text-mute hover:text-ink",
              )}
            >
              <span>{t.label}</span>
              {display !== undefined && (
                <Pill variant={isActive ? "oak" : "neutral"}>{display}</Pill>
              )}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
```

Comportamento sem JS: `<Link>` navega como GET normal → page re-renderiza com novo `?tab=`. Com JS: client-side transition via prefetch.

---

## Page — `/operations/[id]/page.tsx`

```tsx
type OperationTabKey =
  | "visao" | "frentes" | "briefing" | "eventos" | "anexos" | "sla" | "publico";

const VALID_TABS: ReadonlyArray<OperationTabKey> = [
  "visao", "frentes", "briefing", "eventos", "anexos", "sla", "publico",
];

function normalizeTab(raw: string | undefined): OperationTabKey {
  return VALID_TABS.includes(raw as OperationTabKey)
    ? (raw as OperationTabKey)
    : "visao";
}

export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  // ... existing fetches in Promise.all ...
  const { tab: tabRaw } = await searchParams;
  const tab = normalizeTab(tabRaw);

  const tabs = [
    { key: "visao", label: "Visão geral" },
    { key: "frentes", label: "Frentes", count: op.frentes.length },
    { key: "briefing", label: "Briefing" },
    {
      key: "eventos",
      label: "Reuniões & Decisões",
      count: meetings.length + decisions.length,
    },
    { key: "anexos", label: "Anexos", count: attachments.length },
    { key: "sla", label: "SLA", count: openIncidentsCount },
    { key: "publico", label: "Acesso público" },
  ] as const;

  return (
    <>
      <PageHeader ... />
      <OperationHero ... />
      <TabsNav<OperationTabKey>
        tabs={tabs}
        activeTab={tab}
        basePath={`/operations/${op.id}`}
      />
      {tab === "visao" && (
        <>
          <OperationVillainsSection ... />
          <QuickWinsSection ... />
        </>
      )}
      {tab === "frentes" && (
        <FrentesListSection frentes={op.frentes} operationId={op.id} />
      )}
      {tab === "briefing" && (
        <BriefingBlock ... />
      )}
      {tab === "eventos" && (
        <MeetingsDecisionsTimeline ... />
      )}
      {tab === "anexos" && (
        <AttachmentsSection ... />
      )}
      {tab === "sla" && (
        <SLASection ... />
      )}
      {tab === "publico" && (
        <>
          <PublicLinksSection ... />
          <PlaceholderSection ... />
        </>
      )}
    </>
  );
}
```

### Briefing tab content

Atualmente o briefing fica num bloco inline no page. Vou extrair pra `BriefingTabContent` se o JSX é grande o suficiente, OU manter inline (depende do tamanho). Decisão no T-Implement: ler o page e ver tamanho do bloco.

---

## Page — `/public/[token]/page.tsx`

```tsx
type PublicTabKey = "visao" | "frentes" | "anexos" | "sla";

const VALID_PUBLIC_TABS: ReadonlyArray<PublicTabKey> = [
  "visao", "frentes", "anexos", "sla",
];

function normalizePublicTab(raw: string | undefined): PublicTabKey {
  return VALID_PUBLIC_TABS.includes(raw as PublicTabKey)
    ? (raw as PublicTabKey)
    : "visao";
}

// ... no page body:
const tabs = [
  { key: "visao", label: "Visão geral" },
  { key: "frentes", label: "Frentes", count: op.frentes.length },
  { key: "anexos", label: "Anexos", count: attachments.length },
  { key: "sla", label: "SLA", count: incidents.length },
] as const;

return (
  <>
    <PublicHero op={op} />
    <TabsNav<PublicTabKey>
      tabs={tabs}
      activeTab={tab}
      basePath={`/public/${token}`}
    />
    {tab === "visao" && (
      <>
        <PublicVillainsList items={villains} />
        <PublicAchievementsList items={quickWins} />
      </>
    )}
    {tab === "frentes" && <PublicFrentesList frentes={op.frentes} />}
    {tab === "anexos" && <PublicAttachmentsList attachments={attachments} token={token} />}
    {tab === "sla" && <PublicSLAList ... />}
  </>
);
```

---

## Error Handling

| Scenario | Action |
|---|---|
| Tab inválida no param | Fallback pra default `visao` (sem erro) |
| Tab faltando | Default `visao` |
| Tab válida mas section dependente faltando dados | Section interna mostra empty state (já existe) |
| `op.frentes` undefined | Promise.all já garante array; fallback `[]` no acesso |
| Count NaN/null | `count ?? 0` antes de passar |

---

## Tech Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Tab nav local | client component `<Link>` | Funciona sem JS; prefetch quando JS disponível |
| Sticky | `sticky top-0` simples | MVP; sem shadow/transitions |
| Conditional render | `{tab === "x" && <Section />}` | Não renderiza fora da tab ativa; libera React; mantém DOM limpo |
| Promise.all mantém | Sim | Counts precisam de todos os dados |
| Reuso de TabsNav | Sim — primitive em `ui/` | Operations + Public usam mesmo componente |
| URL search param name | `tab` | Padrão |
| Counts > 99 | "99+" | Layout |
| Mobile overflow | `overflow-x-auto` | Tab nav scroll horizontal |
| Active visual | Border-b-2 ink + Pill oak | Consistente com pattern de nav existente |
| Briefing como tab própria | Sim | Item canônico no domínio |
| Acesso público como tab | Sim | Last tab; menos usada mas presente |
| Section "Placeholder" futuro | Vai pra tab "publico" como conteúdo extra ou pulamos | Decisão T-Implement: ler `PlaceholderSection` atual; se é só placeholder de roadmap, remove |
| Counts em "Visão geral" | Não | Não é coleção |
| Counts em "Briefing" / "Acesso público" | Não | Não-quantificável |
| Tab keys | Snake-case curtas (visao, frentes, eventos) | URL-friendly + concisas |
| Default no param | Sem param ou `?tab=visao` igualam | URL canônica sem param |
| router.push vs Link | Link | Funciona sem JS; deep link nativo |
| Browser back history | Funciona via Link nativo | |
| Render mode | Server | Page é server; nav é client |

---

## Notes

- Mudança é puramente UI-layout. Sem migration. Sem mudança em query.
- Counts derivam de arrays já fetched. Zero queries extras.
- Sections continuam server-only (exceto onde já eram client).
- Performance: nenhuma regressão. Conditional render libera React de montar sections inativas.
- `scroll={false}` no Link previne autoscroll pro top ao trocar tab — UX preserva posição.
- Tab counts atualizam em soft-navigation porque page re-renderiza no servidor a cada `?tab=` change. Sem stale.
- PlaceholderSection do page atual: verificar se é placeholder roadmap descartável; se sim, remover na limpeza junto.
- Verificar se `useSearchParams` no client lê o param corretamente em Next 16 — alternativa: client recebe `activeTab` prop direto do server (mais defensivo, sem ambiguidade SSR).
- Decisão: nav recebe `activeTab` prop, não `useSearchParams`. Evita flash de tab errada.
- Test plan inclui validar URL após click + reload + back.
