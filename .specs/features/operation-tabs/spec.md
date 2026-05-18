# operation-tabs Specification

## Problem Statement

`/operations/[id]` é uma pilha vertical com 8 sections. Cada feature adicionou mais scroll: hoje (após sem 03-05) inclui OperationHero, Vilões, QW, Frentes, Briefing, Reuniões/Decisões, Anexos, SLA, Links Públicos, Placeholder. Cliente Core com dados reais (~20 QW, 10 Frentes, 30 reuniões, 50 anexos) vai virar página de 4000px+.

Equivalente em `/public/[token]` tem 6 sections (Hero, Villains, Achievements, Frentes, Attachments, SLA) — cliente externo sofre na mesma proporção.

Pedido: tabs.

## Goals

- [ ] `/operations/[id]` reorganizada em **7 tabs** dentro do conteúdo (OperationHero continua acima como banner)
- [ ] Tab navigation client component, sticky abaixo do hero, search param `?tab=<key>`
- [ ] Default `visao` (Vilões + QW combinados — narrativa de marca primeiro)
- [ ] Counts na label de tabs que têm volume mensurável (Frentes, Anexos, SLA, QW, Reuniões)
- [ ] Estrutura espelhada em `/public/[token]` com tabs adaptadas pra conteúdo público
- [ ] Deep link via URL (`?tab=frentes`)
- [ ] Sem perda de funcionalidade: todas sections atuais continuam acessíveis
- [ ] Sem regressão: build verde, todas queries paralelas mantidas

## Out of Scope

- Animação de transição entre tabs
- Tabs dinâmicas (mostrar/esconder por configuração ou role) — todas tabs visíveis pra qualquer user autenticado
- Reorder de tabs via drag
- Salvar última tab visitada por usuário (localStorage)
- Tabs em outras páginas (`/clients/[id]`, `/persons/[id]`) — só Operação e Public no MVP
- Mostrar count em todas tabs (ex: "Briefing 1") — só nas que somam coleção
- Refator das sections internas (mantém componentes existentes intactos)
- Notificação visual quando tab tem novidade (badge "novo")
- Lazy load por tab — queries continuam todas em Promise.all no server (custo aceitável; cache do Next cobre)
- Mover OperationHero pra dentro de tab — fica acima como banner persistente

---

## User Stories

### P1: Layout com tabs em `/operations/[id]` ⭐ MVP

**Acceptance Criteria**:
1. Hero (PageHeader + OperationHero) continua antes das tabs como banner persistente
2. Componente `OperationTabsNav` (client, "use client") renderiza linha de tabs:
   - Visão geral (default)
   - Frentes (count: `frentes.length`)
   - Briefing
   - Reuniões & Decisões (count: `meetings.length + decisions.length`)
   - Anexos (count: `attachments.length`)
   - SLA (count: `openIncidents`)
   - Acesso público
3. Tab ativa derivada de `useSearchParams().get('tab')` ou default
4. Click muda search param via `router.push(`?tab=<key>`, { scroll: false })`
5. Sticky no top via `sticky top-0` quando scrollar
6. Mobile: scroll horizontal se overflow

### P1: Sections agrupadas por tab ⭐ MVP

**Acceptance Criteria**:
1. **Visão geral**: `OperationVillainsSection` + `QuickWinsSection`
2. **Frentes**: `FrentesListSection`
3. **Briefing**: bloco existente de Briefing vivo
4. **Reuniões & Decisões**: `MeetingsDecisionsTimeline`
5. **Anexos**: `AttachmentsSection`
6. **SLA**: `SLASection`
7. **Acesso público**: `PublicLinksSection` + `PlaceholderSection` (se ainda existir)
8. Page server lê search param via `searchParams`, passa `tab` pro client nav AND condicionalmente renderiza só a tab ativa
9. Sections fora da tab ativa NÃO renderizam (não estão escondidas via CSS — `display: none` mantém DOM e perde otimização)

### P1: Layout espelhado em `/public/[token]` ⭐ MVP

**Acceptance Criteria**:
1. PublicHero continua persistente
2. 4 tabs:
   - Visão geral (default) — `PublicVillainsList` + `PublicAchievementsList`
   - Frentes — `PublicFrentesList`
   - Anexos — `PublicAttachmentsList`
   - SLA — `PublicSLAList`
3. Sem tabs de Briefing/Reuniões/Public Links (não-existem no público)
4. Same nav component reusável ou variação simples

### P1: Deep link via URL ⭐ MVP

**Acceptance Criteria**:
1. URL `/operations/[id]?tab=frentes` abre direto na tab Frentes
2. Recarregar mantém tab
3. Voltar do browser mantém tab anterior (`router.push` cria history entry)
4. Tab inválida no param → fallback pra default `visao`
5. Mesma lógica em public

### P2: Sticky com sombra ao scroll

Pula. Aceita `sticky top-0` sem efeito visual extra no MVP.

### P3: Salvar última tab visitada por usuário

Pula. Deep link cobre.

### P3: Animação fade entre tabs

Pula.

---

## Edge Cases

- **Tab inválida no search param** (`?tab=foobar`) → cai no default `visao` (sem erro)
- **JS desabilitado** — tab nav é client component; sem JS, browser navega via link `<Link>` mudando URL, page server reage. Solução: `OperationTabsNav` usa `<Link>` com `prefetch` em vez de `onClick` push. ✅ Funciona sem JS.
- **Mobile narrow** — tab nav scroll horizontal via `overflow-x-auto`, sem wrap
- **Public link com token expirado** — bloqueio anterior à renderização, não afeta tabs
- **Direct link com `?tab=publico` em /public/[token]** → tab "publico" não existe nesse contexto → fallback pra `visao` do public
- **Empty state em tab** (ex: 0 Frentes) — section interna já tem empty state próprio; tab label mostra "Frentes 0"
- **Sem Briefing criado** — tab "Briefing" mostra placeholder com link de criar
- **Counts > 99** — display como "99+" pra não estourar layout

---

## Success Criteria

- [ ] typecheck + build verdes
- [ ] `/operations/[id]` default abre tab "Visão geral" mostrando Vilões + QW
- [ ] Click em "Frentes" muda URL pra `?tab=frentes` e renderiza FrentesListSection
- [ ] Deep link direto pra `?tab=anexos` funciona
- [ ] Counts batem com dados reais (ex: 3 Frentes → "Frentes 3")
- [ ] `/public/[token]` ganha 4 tabs análogas
- [ ] Mobile: tab nav scrolla horizontalmente sem quebrar
- [ ] Hero (OperationHero / PublicHero) permanece visível acima das tabs
- [ ] Browser back retorna pra tab anterior
- [ ] Smoke preview admin + public

---

## Decisões de Domínio Pré-Design

| Questão | Decisão | Razão |
|---|---|---|
| Quantas tabs | 7 (operations) / 4 (public) | Pedido usuário; tabs separadas vs agrupamento |
| Tab default | `visao` (Vilões+QW combinados) | Narrativa de marca primeiro |
| Counts no label | Sim, em Frentes/Anexos/SLA/Reuniões/QW | Pedido usuário |
| Counts em Briefing/Visão/Público | Não | Não são coleção contável |
| Counts > 99 | Display "99+" | Layout |
| Aplicar em public | Sim, 4 tabs adaptadas | Pedido usuário |
| Tabs em `/clients/[id]` ou outras | Não no MVP | Escopo enxuto; futuro |
| Sticky behavior | Sim `sticky top-0` | Tab nav sempre visível |
| Animação | Não | MVP |
| LocalStorage última tab | Não | Deep link suficiente |
| Lazy load por tab | Não — Promise.all mantém | Cache Next; custo aceitável |
| Render mode | Server condicional baseado em searchParams.tab | Não-renderiza tabs inativas |
| Tab nav: Link vs button | `<Link prefetch>` | Funciona sem JS; mesma URL strategy |
| Hero dentro de tab | Não | Banner persistente |
| OperationHero compartilhado com tabs | Sim, antes do nav | Padrão de detail pages |
| Tabs em `error.tsx` / loading | Não | Tab nav só faz sentido com dados |
| Refator componentes internos | Não | Wrap apenas |
| Search param key | `tab` | Mais legível |
| Default tab key value | `visao` | Sem param OR `?tab=visao` |
| Tab keys | visao/frentes/briefing/eventos/anexos/sla/publico | Snake-case curtas |
| Public tab keys | visao/frentes/anexos/sla | Espelho |
| Briefing tab content | Section atual de Briefing vivo intacta | |
| Erro de validação no form (ex: anexo upload) | Atualmente vive na own section; tabs preservam o param após reload | |
