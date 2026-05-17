# sla Specification

## Problem Statement

Hoje o sistema captura **narrativa** (briefing) e **eventos** (reuniões, decisões, anexos) mas não tem como medir **compromissos operacionais**: "respondemos em até 4h", "resolvemos em até 24h". Quando o cliente pergunta "qual SLA?", a resposta vive no contrato/email/cabeça de alguém — e quando ele rompe, ninguém sabe.

Faltam dois ingredientes:
- **Promessa explícita**: SLA prometido (response/resolution em horas) registrado na Operação
- **Histórico mensurável**: incidentes com timestamps (aberto/respondido/resolvido) pra ver se a promessa foi cumprida

Esta feature fecha a sem 03 trazendo as duas peças: campos SLA na Operação + tabela `sla_incidents` append-only com tracking. Mostra na UI interna, no Hero da Op, em section dedicada, e no painel público (cliente externo vê o que está sendo prometido).

## Goals

- [ ] Operação ganha campos `response_hours: int | null` e `resolution_hours: int | null` (em horas, opcionais)
- [ ] Tabela `sla_incidents`: incidente registrado com severidade + timestamps de abertura/resposta/resolução
- [ ] Helper de breach: incident "breached" se `responded_at - opened_at > response_hours * 1h` OU `resolved_at - opened_at > resolution_hours * 1h`
- [ ] `OperationForm` ganha 2 inputs (response_hours, resolution_hours)
- [ ] `OperationHero` mostra MetaChips "Resposta" + "Resolução" (em horas) quando preenchidos
- [ ] Section nova "SLA & incidentes" em `/operations/[id]` com:
  - Header com promessa atual (response/resolution)
  - Lista de incidentes (mais recentes primeiro) com severity, status, breach pill se aplicável, datas
  - CTA "Registrar incidente" → form
- [ ] Form de incidente (rota dedicada) — criar/editar/responder/resolver/cancelar
- [ ] View pública `/public/[token]` ganha section SLA com promessa + lista de incidentes (sem cancel ações)
- [ ] Hero público mostra chips das promessas

## Out of Scope

- **SLA por Frente** (override granular) — Op-level cobre 80%; per-Frente é v2
- **Notificações de breach automáticas** — Discord vem na sem 05
- **Reports/métricas históricas** ("SLA cumprido em 92% no último mês") — vem com painel admin sem 05
- **Multi-tenant SLAs por horário comercial / weekend** — assume horas corridas (calendar hours, não business hours). Calibrar em v2.
- **Anexar evidência ao incidente** — não no MVP. Usuário pode anexar via `attachments` separado (sem `incident_id` FK por ora).
- **Comentários no incidente** — pula. Textarea de descrição cobre.
- **Reaberta** — incidente resolvido fica resolvido. Re-aparecer = novo incidente referenciando.
- **SLA por canal** (email vs Discord vs site) — fora do MVP.
- **Auto-cálculo de severidade por palavra-chave** — usuário escolhe.
- **Customização de níveis de severidade** — fixo low/medium/high.
- **Indicador de breach no Hero** — só em incidentes específicos. Hero mostra promessa, não breach total.

---

## User Stories

### P1: Campos SLA na Operação ⭐ MVP

**User Story**: Como admin, posso registrar response_hours e resolution_hours numa Op no form de edit.

**Acceptance Criteria**:

1. Migration: ALTER `operations` ADD `response_hours int`, `resolution_hours int` (ambos nullable)
2. Zod: schema da Op aceita opcionais; preprocess de string → int; min 0 max 720 (30 dias em horas)
3. `OperationForm` ganha 2 inputs lado a lado: "Resposta (h)" e "Resolução (h)" — opcionais
4. Update da OperationDetail/Card queries inclui os 2 campos

---

### P1: Display no Hero ⭐ MVP

**User Story**: Ao abrir a Op, vejo MetaChips com a promessa.

**Acceptance Criteria**:

1. `OperationHero` ganha 2 MetaChips extras: "Resposta" (`X h` ou "—" se null) e "Resolução"
2. Visual: usa MetaChip pattern existente
3. Idem `PublicHero` (cliente vê)

---

### P1: Tabela sla_incidents ⭐ MVP

**User Story**: Cada incidente é um registro com timestamps.

**Acceptance Criteria**:

1. Migration: CREATE TABLE `sla_incidents`:
   - id uuid PK
   - operation_id uuid NOT NULL FK CASCADE
   - title text NOT NULL
   - description text
   - severity enum `sla_severity` (low/medium/high)
   - status enum `sla_incident_status` (open/responded/resolved/cancelled) default `open`
   - opened_at timestamptz NOT NULL default now
   - responded_at timestamptz
   - resolved_at timestamptz
   - opened_by uuid FK auth.users SET NULL
   - created_at, updated_at timestamptz
2. CHECKs:
   - responded_at >= opened_at se NOT NULL
   - resolved_at >= responded_at se ambos NOT NULL (resolver implica responder)
   - status='responded' requer responded_at NOT NULL
   - status='resolved' requer responded_at + resolved_at NOT NULL
3. RLS authenticated full crud + index (operation_id, opened_at DESC)
4. Trigger updated_at

---

### P1: Helper breach detection ⭐ MVP

**User Story**: Função pura calcula se um incidente está em breach.

**Acceptance Criteria**:

1. `src/lib/utils/sla.ts`:
   - `BreachLevel = "ok" | "approaching" | "response_breach" | "resolution_breach"`
   - `slaBreachLevel(incident, op): BreachLevel`:
     - Se `responded_at NOT NULL` e `responded_at - opened_at > response_hours h` → `response_breach`
     - Se `responded_at NULL` e `now - opened_at > response_hours h` → `response_breach` (em curso)
     - Se `now - opened_at > response_hours * 0.75 h` e ainda open → `approaching`
     - Idem pra resolution
     - Se status=cancelled OR status=resolved e tudo ok → `ok`
   - `slaBreachPill(level): { text, variant } | null`

---

### P1: Section "SLA & incidentes" em /operations/[id] ⭐ MVP

**User Story**: Em /operations/[id], abaixo de Anexos, vejo a promessa + lista de incidentes.

**Acceptance Criteria**:

1. Section nova `<SLASection />` antes de PublicLinksSection
2. Header h2 + Pill contagem de open + Button "Registrar incidente"
3. Block com promessa: "Resposta em até Xh · Resolução em até Yh" ou "Sem SLA definido" se ambos null
4. Lista incidentes mais recentes primeiro:
   - Card com title (Link pra edit) + severity pill (oak/warning/critical) + status pill + breach pill se aplicável
   - Datas: aberto/respondido/resolvido (relative) + author
   - Description preview
5. Empty state se sem incidentes

---

### P1: Form de incidente ⭐ MVP

**User Story**: Em /operations/[id]/incidents/new (e .../edit), preencho um incidente.

**Acceptance Criteria**:

1. Rotas:
   - `/operations/[id]/incidents/new` — create
   - `/operations/[id]/incidents/[iid]/edit` — edit/update timestamps/status
2. Campos:
   - title (required, min 3 max 200)
   - description (opcional, max 5000)
   - severity (select low/medium/high, default medium)
   - status (select; padrão = current; transitions livres no MVP — sem state machine rígida)
   - opened_at (datetime-local, default now no create; readonly no edit)
   - responded_at (datetime-local, opcional)
   - resolved_at (datetime-local, opcional)
3. Edit: botão Remover (hard delete)
4. Actions: `createIncidentAction`, `updateIncidentAction`, `deleteIncidentAction`

---

### P1: Public view ⭐ MVP

**User Story**: Cliente externo no /public/[token] vê promessa + lista de incidentes públicos.

**Acceptance Criteria**:

1. `PublicHero` mostra MetaChips response/resolution se preenchidos
2. Section nova `PublicSLAList` após Anexos com:
   - Promessa atual
   - Incidentes recentes (todos por enquanto — sem visibility flag em SLA no MVP)
   - Sem botões edit/delete
   - Breach pill visível
3. Decisão: incident **não tem visibility**. Cliente vê todos. Razão: incidentes são da operação cliente, faz sentido transparência. Refinar v2 se algum incident precisar ser interno.

---

### P2: Bulk actions / batch update

Pula. 1 incident por vez.

### P3: Métricas (SLA cumprido %) na home

Pula. Painel admin (sem 05).

### P3: Comentários em incidente

Pula. Description cobre.

---

## Edge Cases

- **response_hours = 0** — Zod aceita (resposta imediata); helper trata como sempre breach se > 0min
- **resolution_hours sem response_hours** — permitido; só checa resolution
- **Incident sem SLA definido na Op** — sem breach calculável; renderiza só status
- **Incident cancelled** → não conta pra breach
- **Incident reopened** — fora do MVP; "cancelled" não significa reabrir
- **Op archived** com incidentes abertos — incidentes continuam; admin resolve antes de archive (sem trigger)
- **CASCADE de Op deletada** — incidents derrubados
- **Timezone** — opened_at em UTC; comparações em ms (consistente)
- **Severity high + breach** — visual reforçado (pill critical com texto adicional)
- **Múltiplos incidents abertos** — todos contam; lista mostra
- **Public view**: incident sem visibility flag — cliente vê tudo. Aceitar; refinar v2.

---

## Success Criteria

- [ ] typecheck + build verdes
- [ ] Acme/Core: editar Op definindo Resposta=4h, Resolução=24h
- [ ] Hero da Op mostra MetaChips
- [ ] Registrar incident "Pipeline com erro" severity=high → aparece na section, sem breach (recém aberto)
- [ ] Editar incident → marcar responded_at 5h depois → breach pill response_breach
- [ ] Marcar resolved_at 30h depois → breach pill resolution_breach
- [ ] Cancelar incident → some breach
- [ ] Public link: cliente vê SLA chips + incidents + breach
- [ ] Screenshots: form Op com SLA, hero com chips, section incidents com 3 estados, public view

---

## Decisões de Domínio Pré-Design

| Questão | Decisão | Razão |
|---|---|---|
| Op-level vs Frente-level | Op-level | 80% dos casos; refinar v2 |
| Schema tracking | Tabela sla_incidents append-likable | Histórico mensurável |
| Severity levels | low/medium/high (enum) | Cobre o útil; mais granular vira v2 |
| Status transitions | Livres no MVP (sem state machine) | Flexibilidade > rigor; CHECKs cobrem inconsistência grave |
| Horas vs minutos | Horas | Granularidade prática; minutos vira v2 |
| Business hours | Não (calendar hours) | MVP simples; refina depois |
| Visibility em incident | Não | Cliente vê tudo; refina v2 |
| Anexos em incident | Não no MVP | Usa attachments separado se precisar |
| Reaberta | Não | Novo incident |
| Auto-resolver via Op archive | Não | Manual |
| Breach approaching threshold | 75% | Dá tempo de agir antes |
| Severity high + critical breach | Pill com texto adicional | Visual reforço |
| Public view: filtra cancelled? | Sim | Não confunde cliente com ruído |
