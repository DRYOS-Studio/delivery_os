# allocations-crud Specification

## Problem Statement

Allocations (Pessoa × Frente com role + capacidade) só existem via seed. Hoje:
- FrenteForm tem campo "Responsável" (1 person), mas alocações múltiplas (executor, aprovador, plantão com capacidade) ficam órfãs
- Person detail mostra alocações read-only — sem edit
- Sem CRUD, time real não consegue refletir realidade operacional

Esta feature fecha a semana 02: completa o quinto e último CRUD das entidades base. Pequeno, mas chave pro Painel Admin futuro (sem 05 vai usar capacidade semanal agregada por pessoa pra detectar sobrecarga).

## Goals

- [ ] Usuário gerencia alocações de uma Frente: visualiza, cria, edita, remove
- [ ] FrentesEditPage ganha seção "Alocações" no fim com lista + "+ Nova alocação"
- [ ] Rotas `/operations/[id]/frentes/[fid]/allocations/new` e `.../[aid]/edit`
- [ ] Action `archiveFrenteAction` continua funcionando (já bloqueia se há allocations); agora user pode remover allocations primeiro pra desbloquear archive

## Out of Scope

- **Listagem global `/allocations`** — não faz sentido isolada; allocations vivem dentro de Frente
- **Manage alocações pelo lado da Pessoa** — Person detail só lê; gerenciar pelo Frente
- **Cap weekly summary por pessoa** (alert "Rafael tem 110% semanal") — feature do Painel Admin sem 05
- **Bulk allocate** (atribuir N pessoas em batch) — futuro se demanda surgir
- **Histórico de alocações arquivadas** — sem `archived_at` no schema; soft-delete não aplicável
- **Soft-delete via flag** — schema não tem coluna; **hard delete** com confirmação. (CASCADE de Person/Frente continua valendo se a parent for arquivada/removida)
- **Avatar component novo** — já existe; reusa

---

## User Stories

### P1: Seção "Alocações" na FrenteEditPage ⭐ MVP

**User Story**: Como admin, ao editar uma Frente, quero ver lista de quem está alocado nela, com role + capacity, e poder adicionar/editar/remover.

**Why P1**: Bloqueia gestão real de alocação; sem isso, seed engessa o sistema.

**Acceptance Criteria**:

1. WHEN `/operations/[id]/frentes/[fid]/edit` é visitada THEN ABAIXO do form da Frente SHALL renderizar nova section "Alocações":
   - Header: `<h2>Alocações</h2>` + Pill com contagem + botão "+ Nova alocação" (sage size sm) à direita
   - Se vazia: card centralizado "Nenhuma alocação nesta Frente." + CTA "Criar primeira alocação"
   - Se há: lista com `<Avatar size="sm">` + nome da Pessoa + Pill role + capacity% mono + dates compactas + "Editar →"
2. O botão "+ Nova alocação" navega pra `/operations/[id]/frentes/[fid]/allocations/new`
3. Click "Editar →" navega pra `/operations/[id]/frentes/[fid]/allocations/[aid]/edit`

---

### P1: Criar Alocação ⭐ MVP

**User Story**: Como admin, na nova rota `.../allocations/new`, quero selecionar pessoa interna, role, capacity, start_date.

**Why P1**: Block sem isso.

**Acceptance Criteria**:

1. WHEN visita `/operations/[id]/frentes/[fid]/allocations/new` THEN preload `getOperation(id)` (pra header context) + `getFrente(fid)` + `listInternalPersons()` em paralelo. Se inválido, redirect.
2. Form `<AllocationForm mode="create" />` com:
   - **Pessoa** (select internal persons; required; "—" placeholder)
   - **Papel** (select: Responsável / Executor / Aprovador / Plantão; required; default `executor`)
   - **Capacidade semanal (%)** (number input, 0–100, required, default 0; helper "% da semana comprometida")
   - **Data de início** (date, required, default hoje)
   - **Data de fim** (date, opcional; helper "Vazia = aberto")
3. `createAllocationAction(operationId, frenteId, formData)` valida via Zod:
   - person_id uuid
   - role enum
   - capacity_weekly_pct number ≥0 ≤100
   - start_date required, end_date ≥ start_date se ambos
4. Em sucesso → redirect `/operations/[id]/frentes/[fid]/edit` (volta pra Frente que originou a ação)
5. PageHeader: `title="Nova alocação"` `subtitle="{Frente.name} · {Op.name} · {Client}"`

---

### P1: Editar Alocação + Remover ⭐ MVP

**User Story**: Como admin, quero ajustar role/capacity de uma alocação ou removê-la (hard delete).

**Why P1**: Sem isso, errado fica errado pra sempre.

**Acceptance Criteria**:

1. WHEN visita `.../allocations/[aid]/edit` THEN preload alocação atual; redirect se inválida/não pertence ao Frente do path
2. Form pré-preenchido. **Pessoa disabled** (pra trocar = nova alocação)
3. `updateAllocationAction(id, formData)` salva
4. Botão "Remover" (ghost critical) → `window.confirm("Remover esta alocação?")` → `deleteAllocationAction(id)` **hard delete** → redirect frente edit
5. Em sucesso (salvar) → redirect `/operations/[id]/frentes/[fid]/edit`

---

### P1: Validação cross-field ⭐ MVP

**Acceptance Criteria**:

1. Zod: `capacity_weekly_pct` ≥ 0 e ≤ 100 (espelha CHECK constraint do DB `chk_allocations_capacity_range`)
2. Zod: `end_date ≥ start_date` se ambos preenchidos
3. Erro inline; código `validation_capacity_weekly_pct`, etc.

---

### P2: Atualizar PersonAllocationsSection com link "Editar"

**User Story**: Na Person detail, cada alocação na lista linka pra rota de edit.

**Why P2**: Bom UX, mas Person detail é leitura primária. P1 já cobre via Frente.

---

### P3: Mostrar Avatar do executor na FrentesListSection (não só responsável)

Hoje só mostramos responsável. Poderia mostrar avatares empilhados do time. Pula por enquanto.

---

## Edge Cases

- WHEN allocation já existe pra mesma combinação (person × frente × role × período) THEN não tem unique constraint no DB; permite duplicata (cap weekly soma — UI futura pode alertar). Aceitar.
- WHEN Pessoa selecionada está arquivada THEN listInternalPersons já filtra; se ficar arquivada entre fetch e submit, FK violation 23503 → `err('Pessoa inválida.', 'invalid_person')`
- WHEN capacidade entrada como string "50,5" (BR) THEN Zod coerce; ou converter no parse: `Number(input.replace(",", "."))`
- WHEN end_date < start_date THEN Zod refine
- WHEN tentar remover alocação que tem... nada que dependa dela. CASCADE só nos dois sentidos (person/frente). Hard delete sempre seguro.
- WHEN allocation id no URL não pertence ao frente do path THEN redirect (mesma defesa que frente.operation_id check)

---

## Success Criteria

- [ ] typecheck + build verdes
- [ ] Em `/operations/[id]/frentes/[fid]/edit` da Acme Core/Infra: ver Rafael alocado como executor 40% no seed
- [ ] Click "+ Nova alocação" → criar Gabi como aprovadora 20% → aparece na lista
- [ ] Editar a do Rafael → mudar pra 30% → reflete
- [ ] Remover (window.confirm) → some
- [ ] Após archive de Frente, allocations vão junto (CASCADE — confirma no DB)
- [ ] Person detail (Rafael) reflete as mudanças
