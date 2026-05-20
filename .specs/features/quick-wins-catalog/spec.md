# quick-wins-catalog Specification

**Issue:** [#64](https://github.com/rafaelemeth/delivery_os/issues/64)
**Parent feature:** `catalog-admin` (Semana 04 do MVP, último item)

## Problem Statement

Hoje o time cria Quick Wins do zero em cada Operação — digitando título, descrição e definindo impacto por vilão na mão. Repetição inevitável: "Automação de relatório recorrente" vira QW em 5 clientes com 5 nomes diferentes e 5 percentuais diferentes. Isso quebra a comparabilidade entre operações e desperdiça tempo de quem cria.

Esta feature cria o **catálogo de tipos de Quick Win** previsto no PRD ("tipos pré-definidos com pesos sugeridos por vilão"). Admin gerencia em `/catalog/quick-wins`. Ao criar QW numa Operação, o usuário pode escolher um tipo do catálogo que pré-preenche título/descrição/impacto — e ainda pode ajustar caso a caso.

## Goals

- [ ] Tabela `quick_win_catalog` criada com 21 entradas seed (3 por vilão, cobrindo os 7 vilões)
- [ ] Admin gerencia tipos em `/catalog/quick-wins` (CRUD + archive/restore)
- [ ] Form de criar QW em Operação ganha select opcional "Tipo do catálogo" que pré-preenche título, descrição e adiciona impacto sugerido no vilão correspondente (se presente na Op)
- [ ] Sidebar "Catálogos" ganha terceiro sub-item "Quick Wins"

## Out of Scope

- **Múltiplos vilões sugeridos por QW** — neste PR `suggested_villain_id` é único. Múltiplos impactos sugeridos virariam tabela de junção; v2 se incomodar.
- **Snapshot de origem na QW criada** — não vamos persistir `from_catalog_id` no QW criado. Auto-fill é só conveniência de form; depois do submit a QW é independente do catálogo (admin pode editar o tipo no catálogo sem afetar QWs antigas).
- **Estatísticas de uso por tipo** — quantas QWs criadas via tipo X. Dashboard v2.
- **Reordenação manual** — alfabético por título por enquanto.
- **Exposição no link público** — catálogo é interno.

---

## User Stories

### P1: Schema `quick_win_catalog` + seed ⭐ MVP

**User Story**: Como sistema, preciso de uma tabela onde catalogar tipos de QW com peso sugerido por vilão, semeada com 14 entradas iniciais.

**Why P1**: Sem o schema + seed, nada acontece.

**Acceptance Criteria**:

1. WHEN migration roda, THEN tabela `quick_win_catalog` SHALL existir com colunas: `id uuid PK`, `title text NOT NULL`, `description text`, `suggested_villain_id uuid` (nullable, FK villains ON DELETE SET NULL), `default_impact_pct smallint`, `archived_at timestamptz`, `created_at`, `updated_at`
2. CHECK `title_min_length` (≥ 3 trim, ≤ 120)
3. CHECK `default_impact_pct_range` (1..100) — nullable; quando preenchido tem que estar no range
4. Index UNIQUE em `lower(trim(title))` evita duplicatas case-insensitive
5. Index `idx_qwc_archived_active` parcial em `(title)` WHERE archived_at IS NULL
6. RLS habilitada com policy `authenticated_full` (Inv. 12)
7. Trigger `set_updated_at`
8. `COMMENT ON TABLE` explicando propósito
9. 21 produtos seed cobrindo 7 vilões (3 por vilão), todos com `default_impact_pct` 8-15
10. `npm run gen:types` reflete a nova tabela

**Independent Test**: SQL `SELECT count(*), v.slug FROM quick_win_catalog qwc JOIN villains v ON v.id=qwc.suggested_villain_id GROUP BY v.slug` retorna 7 vilões, cada com 3 entradas.

---

### P1: Queries do catálogo ⭐ MVP

**User Story**: Como app, preciso de queries pra listar (admin), listar ativos (form), buscar por id.

**Acceptance Criteria**:

1. `listQuickWinCatalog()` retorna `QuickWinCatalogRow[]` (todos) ordenado por title ASC
2. `listActiveQuickWinCatalog()` retorna `QuickWinCatalogListItem[]` filtrado `archived_at IS NULL`, com join de vilão sugerido (id + name + slug)
3. `getQuickWinCatalogItem(id)` retorna `QuickWinCatalogRow | null`
4. Usa `createServer` (autenticado)

**Independent Test**: Arquivar 1 item → `listActiveQuickWinCatalog` retorna 20 (não 21); `listQuickWinCatalog` retorna 21.

---

### P1: Server actions de CRUD ⭐ MVP

**User Story**: Admin cria/edita/arquiva/restaura tipos via Server Actions.

**Acceptance Criteria**:

1. `createQuickWinCatalogAction(formData)`, `updateQuickWinCatalogAction(id, formData)`, `archiveQuickWinCatalogAction(id)`, `restoreQuickWinCatalogAction(id)`
2. Todas começam com `requireAdminAction` (Inv. 14)
3. Zod valida `{ title, description (opt), suggested_villain_id (opt uuid), default_impact_pct (opt int 1-100) }`
4. DB error 23505 → `err('Título já existe no catálogo.', 'title_conflict')`
5. DB error 23503 → `err('Vilão inválido.', 'validation_suggested_villain_id')`
6. Retorna `ActionResult<{ id }>`
7. `revalidatePath('/catalog/quick-wins')`

**Independent Test**: Logado admin → criar tipo → action retorna OK. Criar de novo com mesmo título → `title_conflict`. Não-admin → `forbidden`.

---

### P1: Página `/catalog/quick-wins` admin ⭐ MVP

**User Story**: Admin lista, edita e arquiva tipos do catálogo.

**Acceptance Criteria**:

1. Não-admin acessa → `notFound()`
2. Admin vê:
   - PageHeader "Catálogo · Quick Wins" + botão "+ Adicionar tipo" + link "← Vilões" / "Produtos →"
   - Cards de tipos ativos: título, descrição truncada, pill do vilão sugerido (com ícone), pill `+X%` se tem `default_impact_pct`
   - Seção colapsável de arquivados
   - Cada card tem "Editar →" + ArchiveButton
3. `/catalog/quick-wins/new` e `/[id]/edit` com `QuickWinCatalogForm`

**Independent Test**: Logado admin → /catalog/quick-wins → 21 cards ativos agrupados visualmente.

---

### P1: Form de tipo (create/edit) ⭐ MVP

**User Story**: Admin preenche título, descrição, escolhe vilão sugerido (opcional) e percentual de impacto (opcional).

**Acceptance Criteria**:

1. Campos: title (required), description (textarea opt), suggested_villain_id (select com 7 vilões ativos + opção "— sem sugestão —"), default_impact_pct (number 1-100, opt)
2. RHF + Zod resolver; submit chama action correspondente
3. OK → redirect `/catalog/quick-wins` + `router.refresh`
4. Error mapping inline + general

**Independent Test**: Form vazio → preencher tudo → salvar → aparece na listagem.

---

### P1: Integração no `QuickWinForm` (Operação) ⭐ MVP

**User Story**: No form de criar QW em `/operations/[id]`, novo select "Tipo do catálogo" opcional no topo. Escolher pré-preenche título, descrição, e se o vilão sugerido está atribuído à Op, já adiciona um impacto.

**Why P1**: Sem isso, o catálogo fica isolado e perde a razão de existir.

**Acceptance Criteria**:

1. `QuickWinForm` ganha nova prop `catalogItems: QuickWinCatalogListItem[]`
2. Renderiza novo `<select>` "Tipo do catálogo" no topo do form (apenas em `mode='create'`)
3. WHEN usuário escolhe tipo:
   - `setValue('title', tipo.title)` (sobrescreve)
   - `setValue('description', tipo.description ?? '')`
   - se `tipo.suggestedVillain` está em `operationVillains` E `tipo.defaultImpactPct` existe, `append({ operation_villain_id: ov.id, impact_pct: tipo.defaultImpactPct })` — somente se ainda não há impact pra esse vilão
4. WHEN modo edit, select de catálogo SHALL NÃO renderizar (evita re-aplicação de defaults a uma QW que já existe)
5. Callers de QuickWinForm (em /operations/[id]/page.tsx) passam `catalogItems` via `listActiveQuickWinCatalog()`

**Independent Test**: Op com vilão Manualis atribuído → abrir form de nova QW → escolher "Automação de relatório recorrente" → título/descrição preenchem; impacto Manualis +15% aparece.

---

### P1: Sidebar adiciona "Quick Wins" sub-item ⭐ MVP

**User Story**: Em "Catálogos" da sidebar admin, terceiro sub-item "Quick Wins" → `/catalog/quick-wins`.

**Acceptance Criteria**:

1. SidebarNav `Catálogos.children` ganha entrada `{ href: '/catalog/quick-wins', label: 'Quick Wins', icon: Trophy }`
2. Active state funciona; auto-expansão de Catálogos continua quando em `/catalog/quick-wins`

---

### P2: Snapshot `from_catalog_id` na QW criada

**User Story**: Quando QW é criada a partir do catálogo, persistir `from_catalog_id` pra rastreabilidade de origem.

**Why P2**: Permite dashboard "QWs mais usadas". Não bloqueia MVP.

---

### P3: Múltiplos vilões sugeridos por tipo

Catálogo passa a ter tabela de junção `catalog_villain_weights`. v2.

---

## Edge Cases

- WHEN tipo é arquivado, THEN some do select do QuickWinForm e do `listActiveQuickWinCatalog`, mas QWs criadas anteriormente seguem intactas (sem rastreabilidade pra v2 P2)
- WHEN tipo arquivado é restaurado, THEN volta ao select
- WHEN vilão é arquivado, THEN tipos que sugeriam ele continuam funcionando — pill mostra "(arquivado)" no nome do vilão no card admin
- WHEN tipo tem `suggested_villain_id` mas a Op não tem aquele vilão atribuído, THEN selecionar tipo apenas preenche título/descrição (sem auto-impact); usuário adiciona impact manual
- WHEN tipo tem `default_impact_pct = null`, THEN não adiciona impact mesmo se vilão coincide
- WHEN título duplicado case-insensitive ("Auto X" vs "auto x"), THEN UNIQUE index rejeita → `title_conflict`

---

## Success Criteria

- [ ] 21 tipos seed presentes após migration
- [ ] Admin completa fluxo create → edit → archive → restore em < 60s
- [ ] Form de QW em Operação com tipo do catálogo + pré-preenchimento de campos + impact funcionando
- [ ] Sidebar "Catálogos" mostra 3 sub-items
- [ ] Zero regressão: QWs existentes seguem editáveis; form sem catálogo escolhido funciona como antes
- [ ] `npm run typecheck` passa
