# clients-enrich Tasks

**Design**: `.specs/features/clients-enrich/design.md`

---

## Execution Plan

```
Phase 1 — Schema:
  T1 (migration: 13 ADD COLUMN + 4 CHECKs)
  T2 (regenerate types)

Phase 2 — Domain:
  T3 (validators/client.ts estendido com 13 campos)
  T4 (actions/clients.ts: formDataToClientInput strip masks; payload spread)
  T5 (queries/clients.ts: getClientSummary)

Phase 3 — Utils:
  T6 (utils/mask.ts: formatCnpj, formatCep, applyCnpjMask, applyCepMask, stripDigits)
  T7 (utils/ufs.ts: const UFS)

Phase 4 — UI:
  T8 (ClientForm: 4 sections, máscaras live, UF select)
  T9 (ClientSummarySection)
  T10 (ClientIdentitySection)

Phase 5 — Page:
  T11 (/clients/[id]/page.tsx: Promise.all profile+summary; renderizar 2 sections novas)

Phase 6 — Ship:
  T12 (DATABASE_SCHEMA.md)
  T13 (build + smoke preview)
  T14 (issue já existe #49; commit + PR + merge)
```

Caminho crítico: T1→T2→T3→T4→T8→T11→T13→T14. Paralelo: T5↔T6↔T7, T9↔T10. ~70-90min.

---

## Task Breakdown

### T1: Migration `<ts>_clients_enrich.sql`

- [ ] 13 ALTER TABLE ADD COLUMN IF NOT EXISTS (nullable)
- [ ] 4 CHECK constraints via `DO $$ IF NOT EXISTS pg_constraint ... ALTER TABLE ADD CONSTRAINT`:
  - check_clients_cnpj_length (14)
  - check_clients_state_length (2)
  - check_clients_zip_length (8)
  - check_clients_email_shape (LIKE %_@_%.%)
- [ ] COMMENT ON COLUMN: cnpj (só dígitos), address_zip (só dígitos), address_state (UF), primary_contact_name (texto livre)
- [ ] Aplicado via MCP `apply_migration`

---

### T2: Regenerate types

- [ ] `npm run gen:types`
- [ ] Verificar Database.public.Tables.clients tem 13 colunas novas

---

### T3: validators/client.ts estendido

- [ ] Helper `optionalText(max)`, `optionalDigits(len, msg)`, `optionalEmail`, `optionalState`
- [ ] Adicionar 13 campos no `clientSchema`
- [ ] Preservar `name`, `slug`, `notes` existentes

---

### T4: actions/clients.ts atualizado

- [ ] `formDataToClientInput`:
  - Strip não-dígitos de `cnpj` e `address_zip` (antes de Zod)
  - Uppercase `address_state`
  - Retornar todos os 16 campos
- [ ] `createClientAction` + `updateClientAction`: spread completo no insert/update payload
- [ ] Validar codes de erro `validation_<field>` cobrem novos campos
- [ ] Verificar slug logic não quebrou

---

### T5: queries/clients.ts: getClientSummary

- [ ] Type `ClientSummary` (activeOperations, archivedOperations, activeFrentes, mrrTotal)
- [ ] Fetch operations do cliente (id, archived_at, monthly_recurring_revenue)
- [ ] Agregar local: count active/archived + sum MRR (active only)
- [ ] Fetch frentes count via join `operations!inner(client_id)` filtrando ambos `archived_at IS NULL`
- [ ] Throws padronizados

---

### T6: utils/mask.ts

- [ ] `stripDigits(raw)` — return raw.replace(/\D/g, '')
- [ ] `formatCnpj(digits)` — 14 chars → `00.000.000/0000-00`; null/short → null
- [ ] `formatCep(digits)` — 8 chars → `00000-000`; null/short → null
- [ ] `applyCnpjMask(raw)` — live mask, aceita parcial, limita 14 dígitos
- [ ] `applyCepMask(raw)` — live mask, limita 8 dígitos

---

### T7: utils/ufs.ts

- [ ] Array 27 UFs como `as const`

---

### T8: ClientForm refactor

- [ ] Importar mask helpers e UFS
- [ ] defaultValues: pré-popular novos campos do `initialData` (CNPJ/CEP via `formatCnpj`/`formatCep` pra exibir formatado no input)
- [ ] Adicionar 13 fields no form com `register`
- [ ] CNPJ + CEP inputs com `onChange` que aplica `applyCnpjMask` / `applyCepMask` e atualiza valor via `setValue`
- [ ] UF como `<select>` com options de UFS
- [ ] onSubmit: pegar valores raw do RHF; CNPJ e CEP já estão formatados → strip antes de fd.set; campo a campo
- [ ] Section helper local: header h3 + spacing
- [ ] 4 sections: Identificação / Contato / Endereço / Observações
- [ ] Errors propagados via setError em todos os campos

---

### T9: ClientSummarySection

- [ ] Server component
- [ ] Props: summary, isAdmin
- [ ] header h2 "Resumo"
- [ ] grid responsive 2/3/4 cols
- [ ] 3 MetricCards comuns + 1 admin only (MRR)
- [ ] Variants: sage pra active, neutral pra archived

---

### T10: ClientIdentitySection

- [ ] Server component
- [ ] Props: client (ClientDetail)
- [ ] Helper local `hasAnyField(...args)` pra esconder blocos vazios
- [ ] 3 blocos em grid: PJ / Contato / Endereço
- [ ] Display:
  - CNPJ formatado via formatCnpj
  - Email como `<a href="mailto:...">`
  - Phone como `<a href="tel:...">`
  - CEP formatado via formatCep
  - Address linha completa: street, number / complement / district / city - state / CEP
- [ ] Esconder section inteira se todos blocos vazios

---

### T11: /clients/[id]/page.tsx atualizar

- [ ] Import ClientSummarySection, ClientIdentitySection, getClientSummary, getProfile
- [ ] Promise.all com mais 2 fetches: getProfile, getClientSummary
- [ ] isAdmin = profile?.role === 'admin'
- [ ] Renderizar antes da lista de Operações:
  1. ClientSummarySection (passa isAdmin)
  2. ClientIdentitySection
- [ ] Estrutura: PageHeader → notes → Summary → Identity → ExternalPersons → Diagnostic → Operações

---

### T12: DATABASE_SCHEMA.md

- [ ] Atualizar seção `clients` listando todas as colunas novas (legal_name, cnpj, IE, primary_contact_*, address_*)
- [ ] Adicionar CHECKs documentadas
- [ ] Adicionar migration na lista
- [ ] Última análise = 2026-05-18

---

### T13: Build + smoke preview

- [ ] `npm run build` verde
- [ ] Preview: criar Cliente novo, preencher tudo (PJ + contato + endereço); ver salvar
- [ ] Editar cliente existente; ver pré-popular máscaras
- [ ] Detail page: blocos PJ + Contato + Endereço renderizam formatado
- [ ] Resumo: contagens batem com SQL manual
- [ ] Admin vê MRR card; verificar empty state se nenhum field PJ preenchido
- [ ] SQL verify CHECKs: tentar inserir cnpj '123' → rejeitado

---

### T14: Commit + PR + merge

- [ ] Branch `feat/clients-enrich`
- [ ] Commit
- [ ] `gh pr create` com `Closes #49`
- [ ] User aprova; merge

---

## Pre-Impl

Pace: reto T1→T13, pauso antes do PR. ~70-90min.

**Riscos:**
- T8 máscara live: setValue em onChange pode ressetar cursor position. Aceitar UX pequena no MVP; cursor jump é raro com pouca digitação.
- T8 CNPJ pre-popular: precisa formatar valor existente do banco (só dígitos) com `formatCnpj` ANTES de virar defaultValue.
- T4 strip digits no FormData: garantir que valores vazios continuem `""` → undefined no Zod (`emptyToUndefined` preprocess existente).
- T5 join frentes via operations!inner: gerador de types Supabase pode retornar shape esquisito. Pode cair em count separado por loop se for chato.
- T1 migration CHECK email: regex SQL é caro; uso LIKE `%_@_%.%` (3 chars: `[1]@[1].[1]`) — aceita "a@b.c". Falsos positivos OK no MVP.
- T9 layout 4 cards: em desktop fica 4 col; em mobile 2x2. Verificar visual.
- T10 esconder bloco vazio: helper `hasAnyField` precisa cobrir todos os campos relevantes de cada bloco.
