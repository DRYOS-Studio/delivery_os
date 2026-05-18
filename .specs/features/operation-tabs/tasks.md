# operation-tabs Tasks

**Design**: `.specs/features/operation-tabs/design.md`

---

## Execution Plan

```
Phase 1 — Primitive:
  T1 (TabsNav.tsx em src/components/ui/)

Phase 2 — Operations page:
  T2 (/operations/[id]/page.tsx: searchParams.tab, normalize, conditional render)

Phase 3 — Public page:
  T3 (/public/[token]/page.tsx: mesmo padrão, 4 tabs)

Phase 4 — Ship:
  T4 (build + smoke preview admin + public)
  T5 (commit + PR + merge)
```

Caminho crítico: T1→T2→T3→T4→T5. ~45-60min.

---

## Task Breakdown

### T1: TabsNav primitive

- [ ] Criar `src/components/ui/TabsNav.tsx` (client, `"use client"`)
- [ ] Generic `<K extends string>` pra preservar type safety nas keys
- [ ] Props: `tabs`, `activeTab`, `basePath`, `searchParamName?`
- [ ] Render: `<nav sticky top-0 z-10 bg-bg border-b border-line>` com flex de Links
- [ ] Cada tab: `<Link prefetch scroll={false}>` com label + Pill opcional
- [ ] Active visual: border-b-2 ink + Pill `oak`; inativa: border-transparent + Pill `neutral`
- [ ] Count > 99 → "99+"
- [ ] Overflow horizontal em mobile

---

### T2: /operations/[id]/page.tsx

- [ ] Importar TabsNav
- [ ] Tipo local `OperationTabKey`
- [ ] Helper `normalizeOperationTab(raw)` retornando default `visao`
- [ ] Adicionar `searchParams: Promise<{ tab?: string }>` no signature
- [ ] Await searchParams; derivar `tab`
- [ ] Montar array `tabs` com counts (frentes.length, meetings+decisions, attachments.length, openIncidentsCount)
- [ ] Renderizar PageHeader + OperationHero ANTES da nav
- [ ] `<TabsNav tabs={tabs} activeTab={tab} basePath={\`/operations/${op.id}\`} />`
- [ ] Substituir pilha de sections por switch condicional:
  - `visao`: OperationVillainsSection + QuickWinsSection
  - `frentes`: FrentesListSection
  - `briefing`: bloco de Briefing vivo
  - `eventos`: MeetingsDecisionsTimeline
  - `anexos`: AttachmentsSection
  - `sla`: SLASection
  - `publico`: PublicLinksSection (+ PlaceholderSection se ainda útil)
- [ ] Avaliar PlaceholderSection: se for só "em breve" placeholder de roadmap, remover

---

### T3: /public/[token]/page.tsx

- [ ] Importar TabsNav
- [ ] Tipo local `PublicTabKey` com 4 keys
- [ ] Helper `normalizePublicTab(raw)`
- [ ] Adicionar `searchParams` no signature
- [ ] Montar array tabs: visao / frentes (count) / anexos (count) / sla (count)
- [ ] PublicHero permanece antes da nav
- [ ] TabsNav com basePath `/public/${token}`
- [ ] Switch condicional:
  - `visao`: PublicVillainsList + PublicAchievementsList
  - `frentes`: PublicFrentesList
  - `anexos`: PublicAttachmentsList
  - `sla`: PublicSLAList

---

### T4: Build + smoke

- [ ] `npm run build` verde
- [ ] Smoke admin:
  - Abrir `/operations/[id]` → default tab "Visão geral" com Vilões + QW
  - Clicar "Frentes" → URL `?tab=frentes`, FrentesListSection renderiza
  - Reload na URL → tab mantida
  - Browser back → volta pra tab anterior
  - Counts batem com dados (ex: Frentes "1", se houver 1)
- [ ] Smoke public:
  - Abrir `/public/[token]` → 4 tabs
  - Mesma navegação
- [ ] Mobile (resize 375): tab nav scroll horizontal sem quebrar

---

### T5: Commit + PR + merge

- [ ] commit imperativo
- [ ] gh pr create com `Closes #58`
- [ ] user aprova; merge

---

## Pre-Impl

Pace: reto T1→T4, pauso antes do PR. ~45-60min.

**Riscos:**
- T2 substituição de sections: cuidado pra não derrubar props existentes. Cada section tem assinatura específica (isAdmin, counts internos, etc). Listar antes de mexer.
- T2 Briefing bloco inline: pode ter JSX grande na page atual. Verificar tamanho e considerar extrair pra componente próprio se necessário.
- T2 PlaceholderSection: se for componente vivo, manter; se placeholder roadmap, deletar.
- T3 PublicSLAList props: verificar se aceita lista filtrada (open vs resolved).
- T1 TabsNav generic types: TypeScript com `<K extends string>` em React component pode ser chato em alguns casos. Fallback: usar `string` simples se gerar erro.
- T4 mobile scroll horizontal: testar overflow-x-auto não quebra layout do sidebar.
- T4 search param interaction com browser cache: Next 16 com `searchParams` Promise pode ter caching diferente; testar reload.
