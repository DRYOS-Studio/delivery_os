# meetings-decisions Specification

## Problem Statement

Hoje, depois do `briefing-vivo`, uma Operação tem narrativa estática (briefing) e contexto comercial (operations + frentes). Falta o registro **temporal** do que acontece:

- Reuniões com cliente (kickoff, semanais, ad-hoc) ficam no Discord/Calendar e somem.
- Decisões tomadas (orçamento aprovado, prazo movido, escopo reduzido) viram lore oral. Quando alguém pergunta "por que mudamos X?", ninguém acha.
- Princípio 02 do PRD é explícito: **Decisão ≠ tarefa. Decisão é registro perpétuo. Tarefa executa. Tabelas separadas.** Sem tabela de decisão, princípio é só discurso.
- Invariante 05: **Decisão tem `visibility` própria mesmo dentro de Reunião compartilhada.** Reunião pode ser com cliente, mas decisão específica pode ser interna.

Esta feature continua a sem 03 (camada "vivos") trazendo o registro temporal: reuniões + decisões como dois registros estruturados, ligados por FK opcional (decisão pode nascer numa reunião OU à parte, ex: Discord). Cobre invariantes 02 e 05 do PRD.

## Goals

- [ ] **Reuniões** registradas por Operação: título, data/hora, participantes (N:N com `persons`), notas, visibility (interno/cliente)
- [ ] **Decisões** standalone: ligadas à Operação, opcionalmente a uma Reunião; com título, contexto, decisão tomada, visibility própria
- [ ] Timeline inline em `/operations/[id]` com últimas 5 reuniões + decisões intercaladas cronologicamente
- [ ] Rotas dedicadas pra criar/editar reunião e decisão
- [ ] Pills visuais distinguindo `interno` (warning/oak) de `cliente` (sage)

## Out of Scope

- **Calendário/agendamento** — sem integração com Google Calendar/Discord. `scheduled_at` é manual.
- **Action items derivados** — reunião não gera tarefas automáticas; Decisão ≠ tarefa (princípio 02).
- **Lembretes/notificações** — feature separada (sem 05 com Discord webhook).
- **Comentários** — reuniões/decisões não têm sub-comentários no MVP.
- **Edição colaborativa de notas** — single-author; sem live cursors.
- **Anexos** — virão com feature `attachments` (sem 03).
- **Versionamento de decisão** — decisão é imutável conceitualmente; "mudou de ideia" = nova decisão referenciando a anterior (futuro com `supersedes` FK).
- **Listagem global `/meetings` ou `/decisions`** — vivem dentro da Operação.
- **Visibility "publico"** — só 2 valores no MVP (`interno`, `cliente`). "Publico" entra com `public-link-skeleton`.
- **Validação rica de attendees** — tabela permite duplicatas (FK same person × same meeting); UI evita mas DB não bloqueia.

---

## User Stories

### P1: Tabela de reuniões com participantes ⭐ MVP

**User Story**: Como admin, quero registrar uma reunião com cliente: título, data/hora, participantes (escolhidos da lista de pessoas internas + externas do cliente), notas livres, visibility.

**Why P1**: Sem reunião não há contexto temporal.

**Acceptance Criteria**:

1. Schema novo `meetings` (operation_id FK CASCADE, title, scheduled_at timestamptz, notes text, visibility enum, created_at, updated_at)
2. Schema novo `meeting_attendees` N:N (meeting_id FK CASCADE, person_id FK RESTRICT, PRIMARY KEY composto)
3. Enum novo `meeting_visibility`: `interno`, `cliente`
4. RLS full crud authenticated nos dois
5. Em `/operations/[id]/meetings/new`: form com select Pessoas (internas + externas do cliente da Op), title required, scheduled_at default agora, notes opcional, visibility default `interno`
6. Em `/operations/[id]/meetings/[mid]/edit`: mesma estrutura + botão Remover (hard delete; cascade derruba attendees)

---

### P1: Tabela de decisões standalone ⭐ MVP

**User Story**: Como admin, quero registrar uma decisão tomada (com ou sem reunião associada): título, contexto, decisão em prosa, visibility.

**Why P1**: Invariantes 02 e 05.

**Acceptance Criteria**:

1. Schema novo `decisions` (operation_id FK CASCADE NOT NULL, meeting_id FK SET NULL nullable, title text, context text nullable, decision text NOT NULL, visibility enum, decided_at timestamptz default now, created_at, updated_at)
2. Enum novo `decision_visibility`: `interno`, `cliente` (mesmas labels)
3. RLS full crud
4. Em `/operations/[id]/decisions/new`: form com title required, context opcional, decision required, visibility default `cliente`, meeting_id opcional (select com reuniões da Op)
5. Em `/operations/[id]/decisions/[did]/edit`: mesma + Remover

---

### P1: Timeline integrada em /operations/[id] ⭐ MVP

**User Story**: Na página da Operação, quero ver últimas reuniões + decisões intercaladas por data.

**Why P1**: Sem visualização, registro vira dado morto.

**Acceptance Criteria**:

1. Substitui o `<PlaceholderSection title="Reuniões e decisões" />` em `/operations/[id]/page.tsx`
2. Section "Reuniões e decisões" com:
   - Header: h2 + Pill contagem + dropdown/Link "+ Nova" (com sub-opções "Reunião" e "Decisão" como dois Links)
   - Timeline cronológica DESC: cada item exibe `<TimelineItem>`
     - Icon (CalendarDays pra Meeting, Gavel pra Decision)
     - Pill visibility (sage `cliente` / warning `interno`)
     - Título + data relativa
     - Preview de 120 chars (notes pra meeting; decision pra decision)
     - Link "Ver / Editar →"
   - Empty state com CTA "Registre a primeira reunião ou decisão"
3. Limit 8 items na timeline; se há mais, Link "Ver todos (N)" (out of scope: rota dedicada — fica como follow-up se demanda)

---

### P1: Pills visuais por visibility ⭐ MVP

**User Story**: Como admin, vejo de relance quais reuniões/decisões são internas vs visíveis ao cliente.

**Acceptance Criteria**:

1. `interno` → Pill warning (mesma cor de "Janela crítica") + ícone Lock
2. `cliente` → Pill sage + ícone Users
3. Mesmo padrão na timeline, no view de detalhe e no list de attendees
4. Pill aparece **separada** em Meeting e em Decision (princípio Inv. 05)

---

### P2: View detalhado de reunião e decisão

**User Story**: Click no item da timeline leva pra view com tudo + lista de attendees.

**Why P2**: Edit page já dá acesso ao conteúdo; view dedicado é polish.

**Acceptance Criteria**:

- Out of scope MVP — usuário usa edit page como view. Edit ergonômico (sem readonly mode).

---

### P3: Listagem global filtrada (`/operations/[id]/meetings` separada)

Pula. Timeline na page principal cobre 90% dos casos.

---

## Edge Cases

- **Cliente externo arquivado** entre fetch e attendee insert → FK constraint segura (RESTRICT em person_id). Erro `23503` mapeado pra `invalid_attendee`.
- **Person arquivada** → `listAttendeeCandidates` filtra `archived_at IS NULL`; já alocada pode ficar na lista de attendees existentes mas não aparece pra adição.
- **Visibility cliente em reunião sem decisão visível** → ok. Reunião e decisão são entidades separadas com visibility independente.
- **Decisão sem meeting associado** → ok. `meeting_id` é nullable.
- **Apagar reunião que tem decisão associada** → `ON DELETE SET NULL` na FK `decisions.meeting_id`. Decisão sobrevive sem perder contexto (operation_id preservado).
- **Apagar Operação** → CASCADE derruba meetings + decisions + meeting_attendees em chain.
- **Duplicatas em meeting_attendees** → PRIMARY KEY composto (meeting_id, person_id) bloqueia.
- **scheduled_at futura** → permitida (reunião agendada antes de acontecer).

---

## Success Criteria

- [ ] typecheck + build verdes
- [ ] Acme/Core: criar reunião "Kickoff" com Rafael (interno) + Gabi (externa Acme) como attendees, visibility cliente → aparece na timeline
- [ ] Criar decisão "Reduzir escopo da Frente Infra" linkada à reunião acima, visibility interno → aparece na timeline com pill warning
- [ ] Criar decisão standalone "Aprovado orçamento extra" sem meeting_id, visibility cliente
- [ ] Timeline em /operations/[id] mostra 3 itens intercalados cronologicamente
- [ ] Editar reunião → mudar visibility → reflete na pill
- [ ] Remover reunião associada à decisão → decisão sobrevive (meeting_id null)
- [ ] Remover Operação (archive) — ok, soft archive; teste real de CASCADE só roda manualmente se a Op for deletada via SQL direto
- [ ] Screenshots: timeline com itens, meeting form, decision form, pills variants

---

## Decisões de Domínio Pré-Design

| Questão | Decisão | Razão |
|---|---|---|
| Decisão vinculada a reunião? | Standalone com `meeting_id` opcional FK SET NULL | Princípio 02 + flex pra decisões ad-hoc (Discord, async) |
| Visibility | Enum 2 valores: `interno`, `cliente` | Suficiente pra MVP; `publico` entra em `public-link-skeleton` |
| Attendees | Tabela N:N `meeting_attendees` com FK pra persons | Reúso de pessoas cadastradas (internas + externas do cliente); validação por FK |
| Action items derivados | Não | Inv. 02: decisão ≠ tarefa |
| Versionamento de decisão | Não — decisão é imutável conceitualmente | Mudou? Cria nova; futuro `supersedes_id` FK referencia anterior |
| UI | Section inline + new/edit routes | Timeline = MVP; full listing fica como follow-up |
| Listar global meetings/ ou decisions/ | Não | Vivem dentro da Operação |
| Notes/decision body markdown? | Não — text + whitespace-pre-wrap | Mesma decisão do briefing |
| Hard ou soft delete? | Hard delete com confirmação | Schema sem archived_at em meetings/decisions; CASCADE da Op |
| Validação body min length | Não no MVP | Decisão de 1 linha pode valer; usuário sabe |
| Limite chars | 5000/campo via Zod | Consistente com briefing |
| RLS | Full crud authenticated | Mesma sem 1 (refinar com profiles depois) |
| author_id em decisions? | Não no MVP | profiles ainda não existe; briefing já tem precedente com author_id, mas decisão não tem versionamento então autoria é metadado menos crítico. Adicionar quando profiles existir |
| Order timeline | DESC por scheduled_at (meeting) / decided_at (decision) | Mais recente em cima |
