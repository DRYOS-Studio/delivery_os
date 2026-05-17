# diagnostico-quickwins Specification

## Problem Statement

Fecha a semana 04 do MVP — peça final do "diferencial vendável" da DRYOS. PRD §03: *"PMs tradicionais não têm conceito de vilão, severidade inicial, quick win com peso, % derrotado. Resultado: o diferencial narrativo da DRYOS morre na entrega."*

Sem esta feature:
- O ciclo de marca não fecha: temos vilões atribuídos (PR #40) mas progresso é estático/manual
- Quick Wins ("unidade de avanço") inexistem como entidade
- Cliente público vê "62% derrotado" mas sem entender O QUE foi feito pra chegar lá
- Painel admin (sem 05) "vilão mais derrotado do trimestre" fica sem base mensurável
- Inv. 08 segunda parte (soma de impacto capped 100%) sem implementação

Esta feature traz:
- **Diagnostics**: registro do diagnóstico que originou uma Operação (notes + produto recomendado)
- **Quick Wins**: unidades de avanço com impacto em vilões — derivam o progress_pct automaticamente
- **Inv. 08 enforce**: trigger soma impactos por (op × villain) capped 100%

## Goals

- [ ] Tabela `diagnostics` (per Cliente, opcional): notes, recommended_product, conducted_at
- [ ] FK `operations.diagnostic_id` opcional ligando Op ao diagnóstico origem
- [ ] Tabela `quick_wins`: title, description, executor_id (auth.users), happened_at, FK Op (CASCADE) + FK Frente (SET NULL opcional)
- [ ] Tabela `quick_win_impacts` (M:N): quick_win_id × operation_villain_id, impact_pct int 1-100
- [ ] **Trigger AFTER INSERT/UPDATE/DELETE em quick_win_impacts** recalcula `operation_villains.progress_pct = SUM(impact_pct)`
- [ ] **Trigger BEFORE INSERT/UPDATE em quick_win_impacts** rejeita se sum + new > 100 (Inv. 08)
- [ ] `EditOperationVillainForm` perde input progress_pct (passa a ser derived); evidence permanece
- [ ] Section "Quick Wins" em /operations/[id] entre Vilões e Frentes:
  - Form inline create: title + description + happened_at + frente_id opcional + impactos múltiplos
  - Lista linhas com title + executor + data + chips de impacto ("Manualis +15%")
  - Edit inline / Remover
- [ ] Section "Diagnóstico" em /clients/[id]: card único com notes + recommended_product + edit
- [ ] OperationForm ganha select opcional `diagnostic_id` (linka Op ao diagnóstico do cliente)
- [ ] Public view ganha section "Conquistas do mês" com lista de Quick Wins + pills de impacto

## Out of Scope

- **Quick win catalog (tipos pré-definidos com pesos sugeridos)** — pula MVP; valor sugerido vem em v2 quando houver dados pra calibrar
- **Promote vilões do diagnóstico → operation_villains automático** — diagnóstico fica como referência informativa; vilões da Op continuam atribuídos manualmente (próxima v2 pode automatizar)
- **diagnostic_villains M:N** — diagnóstico hoje é só documento; vilões detectados ficam em notes (texto). Estruturar como M:N vira v2.
- **Tally webhook que cria diagnóstico** — vem na sem 05.
- **Backfill de progress_pct existente** — operation_villains atuais ficam com progress_pct=0 e admins recriam via QWs. Manual SQL pode preservar antes da migration se necessário.
- **Impactos negativos** (revert de QW) — não. Delete do QW remove impactos; trigger recalcula.
- **Audit trail de quem editou** — sem profiles ainda; executor_id no QW basta.
- **Quick Win recorrente** — cada QW é evento único.
- **Templates de QW** — pula.
- **Diagnóstico com revisões** — único registro per Cliente; edit sobrescreve.

---

## User Stories

### P1: Schema diagnostics + quick_wins + impacts ⭐ MVP

**Acceptance Criteria**:

1. Migration unificada cria:
   - Enum `product_recommendation` (core, spark, studio)
   - Tabela `diagnostics`: id, client_id NOT NULL FK CASCADE, notes text NOT NULL, recommended_product `product_recommendation`, conducted_at date, created_at, updated_at. UNIQUE(client_id) — 1 diagnóstico por cliente no MVP.
   - ALTER operations ADD `diagnostic_id` uuid FK SET NULL (linka opcionalmente)
   - Tabela `quick_wins`: id, operation_id NOT NULL FK CASCADE, frente_id FK SET NULL, executor_id uuid FK auth.users SET NULL, title text NOT NULL, description text, happened_at date NOT NULL default current_date, created_at, updated_at
   - Tabela `quick_win_impacts`: id, quick_win_id NOT NULL FK CASCADE, operation_villain_id NOT NULL FK CASCADE, impact_pct int NOT NULL CHECK 1-100, created_at. UNIQUE(quick_win_id, operation_villain_id)
2. Trigger function `validate_quick_win_impact_sum`: BEFORE INSERT OR UPDATE em quick_win_impacts; soma todos impactos pra esse operation_villain_id (incluindo NEW); rejeita se > 100
3. Trigger function `sync_operation_villain_progress`: AFTER INSERT OR UPDATE OR DELETE em quick_win_impacts; recalcula `operation_villains.progress_pct = COALESCE(SUM(impact_pct), 0)` pro operation_villain afetado
4. RLS authenticated full crud nas 3 tabelas
5. Index pra perf das somas
6. **operation_villains agora tem progress_pct gerenciado pelo trigger** — UI deve refletir

---

### P1: EditOperationVillainForm sem progress_pct ⭐ MVP

**Acceptance Criteria**:

1. `EditOperationVillainForm` remove input progress_pct
2. Mensagem: "Progresso é derivado dos Quick Wins desta Operação."
3. evidence permanece editável
4. Validator/action atualizado pra ignorar progress_pct (e action faz UPDATE sem essa coluna)
5. OperationVillainRow continua mostrando progress (derivado)

---

### P1: Quick Wins section em /operations/[id] ⭐ MVP

**Acceptance Criteria**:

1. Section nova entre `<OperationVillainsSection />` e `<FrentesListSection />`
2. Header "Conquistas (Quick Wins)" + Pill contagem + Button "+ Registrar conquista" abre form
3. Form inline:
   - title (required)
   - description (textarea)
   - happened_at (date input, default hoje)
   - frente_id (select opcional, Frentes ativas da Op)
   - impactos: lista dinâmica de pairs (vilão atribuído + impact_pct 1-100); pode adicionar/remover linhas
4. Submit:
   - Cria quick_win
   - Cria quick_win_impacts em batch
   - Se trigger Inv. 08 rejeitar (sum > 100), faz rollback (transaction) e retorna `impact_cap_exceeded`
5. Lista cronológica DESC: cada linha com title, executor email (resolved), data, chips "Manualis +15%" "Silos +10%"
6. Edit inline (toggle) ajusta description, happened_at, frente_id, impacts; severity dos vilões não muda (eles foram atribuídos antes)
7. Remover (× confirmação) → CASCADE remove impacts → trigger recalcula progress_pct

---

### P1: Diagnóstico em /clients/[id] ⭐ MVP

**User Story**: Em /clients/[id], section nova "Diagnóstico" mostra notes + produto recomendado.

**Acceptance Criteria**:

1. Section nova em /clients/[id] (ou em rota dedicada se a page atual for muito limpa — decisão design)
2. Se diagnóstico existe: card com notes (whitespace-pre-wrap), Pill recommended_product, data conduzida
3. Se não existe: empty state + CTA "Registrar diagnóstico"
4. CTA leva a rota `/clients/[id]/diagnostic/edit` (rota dedicada por ser densa)
5. Form: notes textarea required, recommended_product select, conducted_at date

---

### P1: OperationForm ganha select diagnostic_id ⭐ MVP

**User Story**: Ao criar/editar Op, posso linkar ao diagnóstico do cliente.

**Acceptance Criteria**:

1. OperationForm em mode edit (initialData.diagnostic_id) ou create:
   - Carrega diagnóstico do cliente selecionado (se houver)
   - Mostra checkbox "Linkar a diagnóstico de {cliente}" ou disabled se cliente sem diagnóstico
2. Validator + action incluem diagnostic_id nullable

---

### P1: Public "Conquistas do mês" ⭐ MVP

**User Story**: Cliente externo vê QWs recentes com impactos visuais.

**Acceptance Criteria**:

1. Section nova em /public/[token] após PublicVillainsList
2. Header "Conquistas recentes" + Pill contagem
3. Lista linhas (limit 12, mais recentes primeiro):
   - Icon sage check
   - title (font-display)
   - description preview
   - happened_at (relative)
   - Pills de impacto: "Manualis +15%" sage
4. Empty state se nenhuma

---

### P2: Backfill de QWs históricos via Tally

Sem 05.

### P3: Diagnostic com revisões (versioning)

Pula. Single record per cliente.

---

## Edge Cases

- **Adicionar QW com impact > 100 single villain** → trigger Inv. 08 rejeita (cobre via CHECK + sum check)
- **Adicionar QW com sum existing + new > 100** → trigger rejeita; action retorna `impact_cap_exceeded`
- **Editar impact_pct de QW existente que excederia** → trigger rejeita
- **Deletar QW** → CASCADE remove impacts → trigger AFTER DELETE recalcula progress_pct (decremento automático)
- **QW sem nenhum impact** → permitido; é um registro narrativo sem efeito nos vilões
- **Adicionar impact a vilão NÃO atribuído** → FK operation_villain_id resolve; UI só lista vilões atribuídos
- **Editor de evidence em OperationVillain quando há QWs** → ainda funciona; só progress_pct é gerenciado
- **Cliente sem diagnóstico tem Op linkada** → diagnostic_id NULL é OK
- **Diagnóstico deletado de cliente que tem Op linkada** → CASCADE? Decisão: FK CASCADE em diagnostics→client; em operations.diagnostic_id usar SET NULL pra não cascade
- **Cliente arquivado** → diagnóstico fica; CASCADE archive não existe (archived_at não derruba)

---

## Success Criteria

- [ ] typecheck + build verdes
- [ ] Acme: criar diagnóstico com notes + recommended_product=core
- [ ] Acme/Core: linkar Op ao diagnóstico
- [ ] Registrar QW "Automatizou captura WhatsApp" com impacto Manualis +18%, Silos +5%
- [ ] Verificar progress_pct de Manualis e Silos atualizou automaticamente
- [ ] Tentar QW com Manualis +90% (já tem +18%) → erro impact_cap_exceeded
- [ ] Deletar QW → progress_pct decrementa
- [ ] Public link Acme: section "Conquistas recentes" mostra QW com chips
- [ ] Screenshots: diagnostic edit, QW form com impactos, lista QWs, public conquistas

---

## Decisões de Domínio Pré-Design

| Questão | Decisão | Razão |
|---|---|---|
| diagnostics estruturado vs livre | Notes text + recommended_product enum | Simples MVP; v2 pode adicionar diagnostic_villains M:N |
| Diagnostic per cliente ou per op | Per cliente; Op linka opcional | PRD §04: precede a Operação |
| UNIQUE(client_id) em diagnostics | Sim | Single source MVP; revisões viram v2 |
| Quick Win → Frente FK | Opcional | PRD: "vinculado a Op (e opcionalmente Frente)" |
| executor_id | FK auth.users SET NULL | Quem registrou; sem profiles ainda |
| impact_pct range | 1-100 (CHECK) | Sem zero (sem efeito = sem QW) |
| Trigger sync progress | AFTER em quick_win_impacts | Único fonte de verdade |
| Trigger validate Inv. 08 | BEFORE em quick_win_impacts | Rejeita antes de gravar |
| operation_villains progress_pct manual edit | Removido — derivado | Limpa modelo |
| Backfill | Não — admin recria | MVP simples; sem data real ainda |
| Frente FK em QW: CASCADE ou SET NULL? | SET NULL | QW sobrevive se Frente arquivada |
| QW impactos: edit allowed | Sim | Admin calibra |
| Public ordering | happened_at DESC | Recente primeiro |
| Public limit | 12 | Cobertura razoável; pode aumentar v2 |
| Diagnostic Public visibility | NÃO no MVP | Foco em vilões + QWs (resultados, não diagnóstico interno) |
