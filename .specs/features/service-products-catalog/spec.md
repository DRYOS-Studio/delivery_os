# service-products-catalog Specification

**Issue:** [#66](https://github.com/rafaelemeth/delivery_os/issues/66)
**Parent feature:** `catalog-admin` (Semana 04 do MVP)

## Problem Statement

Hoje a Frente não referencia o produto comercial DRYOS que ela entrega (Core, Spark Inbox, Studio Launch, Evergreen, etc). O usuário escolhe `cycle_type` + `domain` na mão, sem saber qual produto está sendo materializado. Falta o link entre a oferta comercial (catálogo do site) e a entrega operacional (Frente).

Esta feature cria o catálogo administrativo de produtos/serviços DRYOS — 12 produtos seed do site — e adiciona FK opcional `product_id` em Frente. Quando o admin escolhe um produto no form da Frente, o `cycle_type` é auto-preenchido com o ciclo natural daquele produto (Core → C, Studio Custom → A, etc), mas continua editável.

## Goals

- [ ] Admin cria/edita/arquiva produtos em `/catalog/products`
- [ ] Frente referencia opcionalmente um produto via `product_id` FK nullable
- [ ] Select de Produto no `FrenteForm` filtra `archived_at IS NULL` e auto-preenche `cycle_type` ao escolher
- [ ] 12 produtos seed aparecem após migration (Core, 5 Sparks, 5 Studios, Evergreen)
- [ ] Frente que aponta pra produto arquivado **continua funcionando** (FK preserva histórico)

## Out of Scope

- **Migration retroativa de Frentes existentes** — `product_id` fica null pras antigas. Admin pode editar e atribuir produto se quiser.
- **Catálogo público** — produtos só aparecem internamente. Site DRYOS continua sendo a fonte de marca/oferta.
- **Pricing/billing** — produtos aqui são taxonomia operacional, não SKU comercial.
- **Variantes por cliente** — produto é universal (como vilões). Sem custom per client.
- **Estatísticas de uso por produto** (quantas Frentes referenciam X) — v2/dashboard.
- **Reorder/display_order** — ordenação alfabética é suficiente no MVP. Adicionar depois se incomodar.

---

## User Stories

### P1: Schema `service_products` + FK em Frente ⭐ MVP

**User Story**: Como sistema, preciso de uma tabela onde catalogar produtos DRYOS com tipo de ciclo padrão, e referenciar do Frente via FK opcional.

**Why P1**: Sem o schema, nada acontece.

**Acceptance Criteria**:

1. WHEN migration roda, THEN tabela `service_products` SHALL existir com colunas: `id uuid PK`, `name text NOT NULL`, `slug text UNIQUE NOT NULL`, `description text`, `default_cycle_type frente_cycle_type` (nullable), `archived_at timestamptz`, `created_at`, `updated_at timestamptz default now()`
2. WHEN migration roda, THEN SHALL existir CHECK `name_min_length` (≥ 2 chars trim)
3. WHEN migration roda, THEN SHALL existir CHECK `slug_format` regex `^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$`
4. WHEN migration roda, THEN SHALL existir índice `idx_service_products_slug` único, e `idx_service_products_archived` parcial em `archived_at IS NULL`
5. WHEN migration roda, THEN RLS SHALL estar habilitada com policy `authenticated_full` (Inv. 12)
6. WHEN migration roda, THEN tabela `frentes` ganha coluna `product_id uuid` nullable + FK `fk_frentes_product_id` com `ON DELETE SET NULL`
7. WHEN migration roda, THEN SHALL ter `COMMENT ON TABLE`
8. WHEN seed roda, THEN SHALL existir 12 produtos: Core (C), Spark Inbox/Bridge/Specialist/Pulse/Cobra (C), Studio Launch (D), Studio Custom/Insight/Bridge+/Agent (A), Evergreen (E)
9. WHEN `npm run gen:types` roda, THEN os types refletem a nova tabela + coluna

**Independent Test**: Aplicar migration → query `SELECT count(*), default_cycle_type FROM service_products GROUP BY default_cycle_type` retorna distribuição esperada. Insert com slug duplicado falha. Insert com `name = 'X'` (1 char) falha.

---

### P1: Queries de produto ⭐ MVP

**User Story**: Como app, preciso de queries pra listar produtos (admin), listar produtos ativos (form), e buscar produto por id.

**Acceptance Criteria**:

1. WHEN `listServiceProducts()` roda, THEN SHALL retornar todos (ativos + arquivados) ordenados alfabéticamente
2. WHEN `listActiveServiceProducts()` roda, THEN SHALL retornar só onde `archived_at IS NULL`
3. WHEN `getServiceProduct(id)` roda, THEN SHALL retornar 1 produto ou null
4. WHEN `getServiceProductBySlug(slug)` roda, THEN SHALL retornar 1 produto ou null (pra validação de unicidade no client)
5. Query layer usa `createServer` (autenticado) — admin gating fica nas actions e na rota

**Independent Test**: Inserir 3 produtos (2 ativos, 1 arquivado) → `listActiveServiceProducts` retorna 2; `listServiceProducts` retorna 3 ordenados.

---

### P1: Server actions de CRUD ⭐ MVP

**User Story**: Como admin, posso criar, editar, arquivar e restaurar produtos via Server Actions.

**Acceptance Criteria**:

1. WHEN admin invoca `createServiceProductAction(formData)`, THEN guard `requireAdminAction` SHALL rodar primeiro
2. WHEN validation Zod falha, THEN SHALL retornar `err(message, 'validation_<field>')`
3. WHEN slug já existe (23505), THEN SHALL retornar `err('Slug já em uso.', 'slug_conflict')`
4. WHEN cria com sucesso, THEN SHALL retornar `ok({ id })` + `revalidatePath('/catalog/products')`
5. WHEN `updateServiceProductAction(id, formData)`, THEN comportamento simétrico ao create
6. WHEN `archiveServiceProductAction(id)`, THEN SHALL setar `archived_at = now()` e revalidar
7. WHEN `restoreServiceProductAction(id)`, THEN SHALL setar `archived_at = null`
8. Todas as actions retornam `ActionResult<T>` — nunca throw (Inv. 13)

**Independent Test**: Logado como admin → criar produto via FormData → action retorna `{ok:true, data:{id}}`. Tentar criar com slug duplicado → `{ok:false, code:'slug_conflict'}`. Não-admin invocando action → `{ok:false, code:'forbidden'}`.

---

### P1: Página `/catalog/products` admin ⭐ MVP

**User Story**: Como admin, em `/catalog/products` vejo lista de todos os produtos (ativos + arquivados separados visualmente) e posso criar/editar/arquivar/restaurar.

**Acceptance Criteria**:

1. WHEN não-admin acessa `/catalog/products`, THEN redirect pra `/` (ou notFound)
2. WHEN admin acessa, THEN vê:
   - Header "Catálogo · Produtos & Serviços" + botão "Adicionar produto" (oak)
   - Lista de produtos ativos: card com nome, slug em mono, badge `default_cycle_type` formatada via `formatCycleTypeShort`, descrição truncada
   - Section "Arquivados" colapsável com produtos arquivados (greyed out)
   - Cada card tem botões: "Editar", "Arquivar"/"Restaurar"
3. WHEN clica "Adicionar produto", THEN abre `/catalog/products/new` com form vazio
4. WHEN clica "Editar", THEN abre `/catalog/products/[id]/edit` pre-preenchido
5. Link discreto em `/catalog/page.tsx` pra `/catalog/products` (e vice-versa, header da nova página linka pra Vilões)

**Independent Test**: Logado admin → /catalog/products → vê 12 produtos seed listados. Cria 1 → aparece. Arquiva → some da seção ativa, vai pra arquivados.

---

### P1: Form de Produto (create/edit) ⭐ MVP

**User Story**: Como admin, no form de produto preencho nome, slug, descrição e ciclo padrão (opcional).

**Acceptance Criteria**:

1. WHEN abre form vazio, THEN campo `slug` SHALL auto-derivar do `name` em tempo real (kebab-case, sem acentos, lowercase)
2. WHEN admin edita `slug` manualmente, THEN SHALL respeitar input dele (parar de auto-derivar)
3. WHEN `default_cycle_type` é select com options: `— sem ciclo padrão —` + 5 opções via `formatCycleTypeLong`
4. WHEN submit, THEN chama action correspondente
5. WHEN error retorna com code `validation_<field>`, THEN mostra erro no campo
6. WHEN error retorna `slug_conflict`, THEN mostra erro no campo slug
7. WHEN OK, THEN redirect pra `/catalog/products` + `router.refresh()`

**Independent Test**: Form aberto, digitar "Spark Cobra" no nome → slug fica "spark-cobra". Editar slug pra "spark-cobra-2" manualmente, voltar e mudar nome pra "Spark Cobra 2" → slug não muda (já foi mexido).

---

### P1: Integração no FrenteForm ⭐ MVP

**User Story**: Como usuário do form de Frente, vejo um select novo "Produto/Serviço" (opcional) acima do "Tipo de ciclo". Ao escolher produto com `default_cycle_type`, o select de tipo é preenchido automaticamente.

**Acceptance Criteria**:

1. WHEN abre `FrenteForm` (create ou edit), THEN SHALL fetch `listActiveServiceProducts()` server-side e passar como prop
2. WHEN renderiza, THEN field "Produto/Serviço" aparece **antes** de "Tipo de ciclo", com opção primeira `— sem produto —`
3. WHEN usuário seleciona produto cujo `default_cycle_type IS NOT NULL`, THEN `cycle_type` SHALL ser atualizado automaticamente (via `setValue`)
4. WHEN usuário seleciona produto sem `default_cycle_type`, THEN `cycle_type` SHALL permanecer como está
5. WHEN usuário muda `cycle_type` manualmente depois de escolher produto, THEN SHALL respeitar a escolha do usuário (não sobrescrever)
6. WHEN edit Frente já tem `product_id`, THEN form vem pré-selecionado mas não dispara auto-fill (preserva estado existente)
7. WHEN submit, THEN `product_id` SHALL ser enviado ao action (ou string vazia = null)

**Independent Test**: Form de nova Frente. Selecionar "Spark Inbox" → tipo vira C. Mudar pra "Studio Custom" → tipo vira A. Mudar tipo manualmente pra B → re-selecionar "Spark Inbox" → tipo volta pra C.

---

### P2: Exibir produto no detalhe da Frente

**User Story**: Em `/operations/[id]/frentes/[fid]` (e no card de Frente), mostrar qual produto está associado.

**Why P2**: Útil pra leitor da operação, mas não bloqueia o MVP da catálogo.

---

### P3: Dashboard de uso por produto

**User Story**: Painel admin mostra contagem de Frentes ativas por produto.

**Why P3**: Insight bom mas não é catalog-admin.

---

## Edge Cases

- WHEN admin tenta arquivar produto que tem Frentes ativas, THEN SHALL permitir (não bloquear); aviso visual no card "N Frentes ativas usando este"
- WHEN produto é deletado por algum motivo no banco (não via UI, só pra defesa), THEN Frentes que apontavam pra ele têm `product_id` setado a NULL via FK `ON DELETE SET NULL`
- WHEN form de Frente carrega 0 produtos ativos (caso degenerado), THEN select fica disabled com placeholder "Nenhum produto disponível — cadastre no catálogo"
- WHEN slug auto-derivado colide com existente, THEN action retorna `slug_conflict` e usuário ajusta manualmente
- WHEN admin restaura produto, THEN volta a aparecer no select da Frente

---

## Success Criteria

- [ ] 12 produtos seed presentes após migration aplicada
- [ ] Admin consegue completar fluxo create → edit → archive → restore em < 60s
- [ ] Form de Frente com select de produto + auto-fill de cycle_type funcionando
- [ ] Zero regressão: Frentes existentes sem `product_id` continuam editáveis
- [ ] `npm run typecheck` passa
- [ ] Tabs/seções públicas (`/public/[token]`) não mudam (produto não vaza pra cliente neste PR)
