# status-acionavel-polish Specification

## Problem Statement

O campo `actionable_status` em Frentes existe desde a sem 02, com validação no banco (CHECK length ≥ 15, rejeita genéricos como "em andamento"). Inv. 04 do CLAUDE.md exige status acionável; até aqui, a validação cobre o **conteúdo**, mas não o **fluxo de uso**.

O problema agora é **disciplina temporal**:
- Sem indicação de "quando foi a última vez que esse status foi mexido", admin não sabe quais Frentes estão paradas há semanas.
- O campo `actionable_status_since` existe (timestamptz, default now) e atualiza só quando muda o conteúdo — mas ninguém olha pra ele.
- Princípio 04 da marca foca em "status acionável obrigatório", mas a UI hoje não cobra atualização.

Esta feature dá **visibilidade temporal**: indicadores visuais escalando por idade (3 níveis) + dashboard na Home listando Frentes que pedem atenção + badge global no nav. Fechar a sem 03 com uma feature que **não cria nova tabela**, só amplifica o que já existe.

## Goals

- [ ] Helper compartilhado `stalenessLevel(since: string): "fresh" | "warm" | "hot" | "critical"`:
  - `fresh` se < 7d (sem pill)
  - `warm` se 7-14d (Pill oak "Há Nd")
  - `hot` se 14-21d (Pill warning "Há Nd · revisitar")
  - `critical` se > 21d (Pill critical "Há Nd · atenção")
- [ ] Home (/) ganha section "Frentes pedindo atenção" com lista de até 8 Frentes ordenadas por mais stale primeiro
- [ ] Card de Frente em `/operations/[id]` (`FrentesListSection`) mostra pill stale quando warm+
- [ ] Cards da Home (se existirem hoje) ganham mesma pill
- [ ] Sidebar nav ganha badge com contagem **total de Frentes em estado hot+critical** (corta warm pra não inflar)
- [ ] FrenteForm ganha hint contextual no campo `actionable_status` mostrando "Última atualização há Xd" (em modo edit)

## Out of Scope

- **Coluna nova no schema** — nada de `stale_threshold_days` por Frente. Thresholds fixos no código (7/14/21).
- **Notificações automáticas** — Discord webhook por staleness vem na sem 05.
- **Edição em lote** ("Marcar todas como atualizadas") — não. Atualizar = mudar `actionable_status` real.
- **Filter/sort manual** na lista da Home — ordem fixa por mais stale primeiro.
- **Histórico de mudanças do status** — usuário muda e ponto. Briefing já cobre histórico narrativo.
- **Per-cycle threshold** (Tipo C/E pode estar parado mais tempo legitimately) — não no MVP. Aceitar falsos positivos; futura v2 ajusta.
- **Badge em /persons/[id]** — escopo restrito por user (não selecionou); foco em Operação + Home + Nav.
- **Indicador em frentes arquivadas** — não. Stale só conta pra Frentes ativas (`archived_at IS NULL`).
- **Persistência do "marcar como visto"** — não. Sem snooze no MVP.

---

## User Stories

### P1: Helper de staleness ⭐ MVP

**User Story**: Funções puras dão consistência ao cálculo de níveis em qualquer lugar do app.

**Acceptance Criteria**:

1. `src/lib/utils/staleness.ts` exporta:
   - `STALENESS_THRESHOLDS = { warm: 7, hot: 14, critical: 21 }` (em dias)
   - `stalenessLevel(since: string | null): "fresh" | "warm" | "hot" | "critical"` — null = fresh; calcula via diff de dias
   - `daysSince(since: string | null): number` — int round-down; null → 0
   - `stalenessLabel(level): { text, variant: PillVariant }`:
     - fresh → null (sem pill)
     - warm → "Há Xd" oak
     - hot → "Há Xd · revisitar" warning
     - critical → "Há Xd · atenção" critical

---

### P1: Home Frentes pedindo atenção ⭐ MVP

**User Story**: Ao abrir a Home, vejo logo as Frentes mais paradas em todo o sistema.

**Why P1**: É o ponto de entrada do app.

**Acceptance Criteria**:

1. Query nova `listFrentesNeedingAttention(limit=8)` em `src/lib/db/queries/frentes.ts`:
   - SELECT frentes WHERE `archived_at IS NULL` AND `actionable_status_since < now() - interval '7 days'`
   - Join com operations (pra mostrar nome+client) e persons (pra responsible)
   - ORDER BY `actionable_status_since ASC` (mais stale primeiro)
   - LIMIT 8
2. Home `/` adiciona section antes do que já tiver lá ou abaixo:
   - Header h2 "Frentes pedindo atenção" + Pill contagem global (hot+critical)
   - Lista com Avatar do responsável (se houver) + nome Frente (link) + Op name (link) + Pill cycle + Pill staleness + actionable_status preview 80 chars
   - Empty state: "Tudo em dia. Nenhuma Frente com mais de 7 dias sem atualização."
3. Se há mais que 8, Link "Ver mais (N)" desabilitado por ora (pula MVP do listing completo)

---

### P1: Pill na FrentesListSection (/operations/[id]) ⭐ MVP

**User Story**: Na page da Operação, vejo de relance quais Frentes daquela Op estão paradas.

**Acceptance Criteria**:

1. `FrentesListSection` recebe (via existing query ou helper) `actionableStatusSince` por Frente
2. Para cada Frente com `stalenessLevel != "fresh"`, renderiza Pill (oak/warning/critical) inline
3. Visual: pill ao lado do nome da Frente ou abaixo

---

### P1: Sidebar badge global ⭐ MVP

**User Story**: No nav lateral, badge mostra contagem de Frentes hot+critical (não inclui warm pra não inflar).

**Why P1**: Visibilidade ambiente sem precisar entrar na Home.

**Acceptance Criteria**:

1. Sidebar/Nav (server component existente) recebe `countHotCritical` via prop ou faz própria query
2. Renderiza badge pequeno ao lado do item "Início" (ou no top do nav)
3. Visual: pill critical se > 0; some se 0
4. Limite display: "9+" se ≥ 10

---

### P1: Hint no FrenteForm ⭐ MVP

**User Story**: Ao editar uma Frente, vejo logo se o status atual está stale.

**Acceptance Criteria**:

1. `FrenteForm` (edit mode) mostra ao lado do label "Status acionável" um pequeno texto: "Atualizado há Xd" + Pill se warm+
2. Hint some no mode create

---

### P2: Tooltip nas Pills explicando o que stale significa

Pula MVP. Pode adicionar `title=""` no Pill se urgente.

---

### P3: Snooze ("revisitei mas vou mexer só amanhã")

Pula. Pode entrar v2 com `actionable_status_acknowledged_at` ou similar.

---

## Edge Cases

- **Frente recém-criada (`actionable_status_since = created_at`)** → 0 dias = fresh. Ok.
- **Frente sem `responsible_person_id`** → renderiza sem avatar; nome só
- **Frente em `phase = encerrada`** → ainda conta pra staleness? **Sim no MVP** (encerrada mas não archived ainda significa que ninguém marcou). Pode refinar v2.
- **Frente archived** → não conta (query filtra `archived_at IS NULL`)
- **Timezone** — `now() - interval` é server-side em UTC; staleness em dias usa Math.floor(diff/86400000). Aceita ±1d de jitter perto da virada. Não crítico.
- **Múltiplas Frentes na mesma Op com idades diferentes** — lista mostra todas; pill na FrentesList mostra individual
- **Sidebar update timing** — server component re-render no navigate; sem realtime. Se admin atualizou Frente, próxima navegação reflete.
- **Performance** — query da Home tem index? Sem index em `actionable_status_since` hoje. Adicionar `idx_frentes_actionable_status_since` (operation_id, actionable_status_since DESC WHERE archived_at IS NULL). Decisão: adicionar via migration leve.

---

## Success Criteria

- [ ] typecheck + build verdes
- [ ] Helper `stalenessLevel` testado mentalmente com 6, 7, 8, 14, 15, 21, 22 dias → fresh, warm, warm, hot, hot, critical, critical
- [ ] Home `/` mostra section com Frente "Pipeline de leads" (que está parada há > 7d no seed)
- [ ] `/operations/[id]` da Acme/Core mostra pill stale na Frente parada
- [ ] Sidebar badge mostra "1" (ou contagem real)
- [ ] FrenteForm edit do "Pipeline de leads" mostra hint "Atualizado há Xd" no Status
- [ ] Atualizar status acionável manualmente → contador some / pills somem
- [ ] Screenshots: Home com section, /operations/[id] com pills, sidebar com badge

---

## Decisões de Domínio Pré-Design

| Questão | Decisão | Razão |
|---|---|---|
| Threshold por Frente vs global | Global (7/14/21 fixo) | Simples; calibrar com observação real antes de personalizar |
| Coluna nova | Não | Reusa `actionable_status_since` que já existe |
| Visibility por papel | Não no MVP | Sem profiles; refinar v2 |
| Tipo C/E (perpétuo) gets stale? | Sim no MVP | Falso positivo aceito; pode refinar v2 com per-cycle |
| Snooze | Não | UX: o caminho é atualizar status real |
| Encerrada → fresh by default? | Não | Stale ainda; archive é o way out |
| Index em `actionable_status_since` | Sim, leve via migration | Performance da query da Home + sidebar count |
| 9+ format pra badge | Sim | Padrão UI clássico |
| Helper module name | `staleness.ts` | Auto-explicativo |
| Renderização stale pill em archived | Não | Já filtra archived_at IS NULL nas queries |
