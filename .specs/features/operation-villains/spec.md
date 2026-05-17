# operation-villains Specification

## Problem Statement

`villains-catalog` (PR #38) trouxe os 7 vilões canon como universo de marca. Agora cada Operação precisa **atribuir vilões detectados** com severidade inicial + progresso em luta. É a peça que conecta catálogo abstrato com instância concreta.

PRD §04: *"Operação ↔ Vilão — relação M:N. Severidade inicial (do diagnóstico), progresso atual (% derrotado, 0-100)."*

Sem esta feature:
- Não conseguimos mostrar o coração visual do MVP: "Vilões em luta" no Hero/dashboard
- Quick Wins (próxima feature) não têm onde somar impacto — `quick_win_impact` referencia operation_villain, não villain direto
- Painel admin agregado da sem 05 ("vilão mais derrotado") fica sem base
- Cliente externo no /public/[token] não vê a narrativa de marca

**Invariantes obrigatórios:**
- Inv. 07: `initial_severity` **write-once** — vem do diagnóstico, não muda depois. Trigger no banco bloqueia UPDATE dessa coluna.
- Inv. 08: `progress_pct` capped 0-100 via CHECK constraint.

## Goals

- [ ] Tabela `operation_villains` (M:N) com:
  - operation_id + villain_id (PK composto OU id próprio? Decisão: id próprio pra ergonomia + UNIQUE(operation_id, villain_id))
  - initial_severity enum (baixo/medio/alto/critico) NOT NULL
  - progress_pct int CHECK 0-100 default 0
  - evidence text (do diagnóstico — frase curta sobre o que motivou)
  - detected_at timestamptz (quando foi detectado, default now)
- [ ] Trigger BEFORE UPDATE bloqueia mudança em initial_severity (Inv. 07)
- [ ] Section `<OperationVillainsSection />` em `/operations/[id]` substitui placeholder "Vilões em luta"
- [ ] Form inline pra atribuir novo vilão (select com vilões ativos não-atribuídos + severidade + evidência opcional)
- [ ] Edit row inline pra ajustar progress_pct + evidence (severidade locked)
- [ ] Remover atribuição (hard delete — vilão sai da Op; histórico vive no diagnóstico futuro)
- [ ] Public view (`/public/[token]`) ganha `<PublicVillainsList />` com narrativa cliente
- [ ] Helper `severityLabel` + `severityVariant` consistente entre admin/public

## Out of Scope

- **Quick Wins / impacto cap soma 100%** — Inv. 08 segunda parte vem na próxima feature (`diagnostico-quickwins`). Aqui só o CHECK 0-100 individual.
- **Diagnóstico** — esta feature **não** cria tabela `diagnostics`. Operation_villains hoje são manualmente atribuídos por admin; quando diagnóstico chegar, passará a popular esta tabela via action.
- **`detected_at` vs `created_at`** — campos separados? Decisão: usar `created_at` (timestamptz default now). `detected_at` semanticamente é o mesmo no MVP. Quando diagnóstico chegar, action populará created_at = data do diagnóstico.
- **Histórico de progress_pct** — sem snapshot. Mudou, é o novo valor. Audit trail vem com Quick Wins (cada QW deixa "+X% no vilão Y").
- **Auto-atribuir vilões via Tally webhook** — vem na sem 05.
- **Override de severidade pelo time** — Inv. 07 explícita; se errou, deletar + recriar.
- **Severity granular além de 4 níveis** — fixo low/medium/high/critical (consistente com PRD).
- **Comentários nos vilões em luta** — pula. evidence cobre.
- **Múltiplas evidências por vilão** — campo único text; usar quebra de linha.
- **Reassinar progress_pct via Quick Win** — vem na próxima.

---

## User Stories

### P1: Schema + trigger write-once ⭐ MVP

**Acceptance Criteria**:

1. Migration cria:
   - Enum `severity_level` (low/medium/high/critical)
   - Tabela `operation_villains` (id PK, operation_id FK CASCADE, villain_id FK RESTRICT, initial_severity, progress_pct CHECK 0-100, evidence, created_at, updated_at)
   - UNIQUE(operation_id, villain_id) — não duplica
   - Trigger BEFORE UPDATE: rejeita se NEW.initial_severity != OLD.initial_severity
2. RLS authenticated full crud
3. Index (operation_id, created_at DESC)

---

### P1: OperationVillainsSection em /operations/[id] ⭐ MVP

**Acceptance Criteria**:

1. Substitui PlaceholderSection "Vilões em luta"
2. Header h2 + Pill contagem + Button "+ Atribuir vilão" abre form inline
3. Lista vilões atribuídos:
   - Card com Icon do vilão (resolveVillainIcon) + nome + citação
   - Pill severidade (initial) + Pill progress_pct grande (oak/sage/warning por nível)
   - Barra de progresso visual (gradient oak→sage)
   - Evidence (text-mute, italic se vazio)
   - Botão "Editar" inline (toggle row → form) + "Remover" (× pequeno, window.confirm)
4. Empty state: card com CTA "Atribuir primeiro vilão"
5. Form inline:
   - Select Vilão (vilões ativos não-arquivados, exclui já atribuídos)
   - Select Severidade
   - Textarea Evidence (opcional)
   - Submit → action → router.refresh

---

### P1: Edit progress_pct + evidence ⭐ MVP

**Acceptance Criteria**:

1. Row do vilão atribuído tem botão "Editar"
2. Toggle row → form mostra:
   - Vilão nome (readonly)
   - Severidade (readonly, com hint "Severidade inicial não muda — Inv. 07")
   - Number input progress_pct 0-100
   - Textarea evidence
   - Salvar + Cancelar
3. Submit → updateOperationVillainAction (que NÃO inclui initial_severity no patch); trigger no banco protege mesmo se app tentar enviar

---

### P1: Remover atribuição ⭐ MVP

**Acceptance Criteria**:

1. Botão × por row (window.confirm)
2. `deleteOperationVillainAction` hard delete
3. Vilão volta a aparecer no select de atribuir

---

### P1: Public view com narrativa ⭐ MVP

**Acceptance Criteria**:

1. `/public/[token]` ganha section "Vilões em luta" após Frentes (antes de Reuniões+Decisões)
2. Cada vilão atribuído:
   - Icon grande + nome
   - Citação italic
   - Pill severidade ("Severidade inicial: ALTA")
   - Pill progress_pct grande
   - Barra de progresso
   - Description do vilão (catalog) — não evidence (cliente vê narrativa de marca, não diagnóstico interno)
3. Vilões com progress_pct = 0 mostrados na cauda
4. Title: "{N} vilões em luta nesta Operação"

---

### P2: Sparkline mensal por vilão

Pula. Sem snapshot histórico.

### P3: Reordenar vilões na page

Pula. Ordem fixa: progress_pct DESC dentro de severity grouping.

---

## Edge Cases

- **Tentar UPDATE de initial_severity** → trigger rejeita com mensagem clara
- **Tentar atribuir vilão arquivado** → form filtra; race entre fetch e submit → action retorna err
- **Vilão arquivado depois de atribuído** → permanece atribuído (Inv. 06 archive não afeta histórico); UI mostra com pill "Arquivado"
- **progress_pct > 100 via SQL direto** → CHECK rejeita
- **progress_pct negativo** → CHECK rejeita
- **operation_villain duplicado** → UNIQUE rejeita; action map 23505 → err
- **Op arquivada** → permite UPDATE de progress (histórico continua) mas bloqueia novas atribuições? **Decisão MVP**: permite tudo. Archive de Op é só flag.
- **CASCADE de Op deletada** → operation_villains derruba
- **DELETE de Villain via service role** → CASCADE ou RESTRICT? **Decisão**: RESTRICT. Inv. 06 já bloqueia DELETE em villains; se escapar via admin, queremos saber que tem operation_villains apontando.
- **Public view: vilão arquivado** → mostra normalmente (cliente vê narrativa; não importa estado do catálogo)

---

## Success Criteria

- [ ] typecheck + build verdes
- [ ] Acme/Core: atribuir 3 vilões (Manualis severity=high, Silos critical, Achismo medium) com evidências
- [ ] Editar Manualis → progress 35% → reflete + barra visual
- [ ] Tentar editar severity via SQL → trigger rejeita
- [ ] Remover Achismo → some + volta ao select
- [ ] Public link Acme: section mostra 2 vilões em luta com barras
- [ ] Screenshots: section admin com 3 vilões, form atribuir, edit row, public view

---

## Decisões de Domínio Pré-Design

| Questão | Decisão | Razão |
|---|---|---|
| PK composto vs id próprio | id uuid + UNIQUE(operation_id, villain_id) | Ergonomia (URL row-level) + integridade |
| Severity 4 níveis | low/medium/high/critical enum | PRD §04 explícito |
| `initial_severity` write-once | Trigger BEFORE UPDATE no banco | Defense-in-depth; ataca Inv. 07 no ponto certo |
| Edit progress | Manual via input | Quick Wins viram override automático |
| Evidence | text opcional max 1000 | Detalhamento curto, sem markdown |
| FK villain | RESTRICT | Inv. 06 + tropeço extra se algo escapar |
| FK operation | CASCADE | Op deletada raramente; preservar limpeza |
| UI inline vs rota | Inline | Densidade visual; sem rota nova |
| Public exposure | Sim com narrativa | Princípio 05 + diferencial de marca |
| Severity locked em edit | UI hint + action ignora + trigger banco | Triplo guard |
| Detected vs created | created_at único | MVP simplifica |
| Ordering | progress_pct DESC | Mais derrotados em cima (motivador) |
| Public ordering | progress_pct DESC | Cliente vê vitórias primeiro |
