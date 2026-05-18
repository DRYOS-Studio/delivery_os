# clients-enrich Specification

## Problem Statement

Tabela `clients` hoje tem só `name`, `slug`, `notes`, soft-delete timestamps. Cadastro raso pra operação real: sem CNPJ, sem endereço, sem contato. E `/clients/[id]` lista Operações mas não tem agregado rápido (quantas ativas, quantas Frentes em curso, MRR total). Admin abre o Cliente pra responder "qual a situação geral" e precisa caçar nas Operações.

## Goals

- [ ] Migration adiciona em `clients`:
  - `legal_name` text (razão social, nullable)
  - `cnpj` text (14 dígitos, nullable; CHECK length=14 se preenchido)
  - `inscricao_estadual` text (nullable)
  - `primary_contact_name`, `primary_contact_email`, `primary_contact_phone` (todos text nullable)
  - 7 colunas de endereço: `address_street`, `address_number`, `address_complement`, `address_district`, `address_city`, `address_state`, `address_zip` (todas text nullable)
- [ ] Validador Zod: CNPJ exatamente 14 dígitos quando preenchido (sem cálculo de DV); UF 2 chars; CEP 8 dígitos; email RFC; demais texto livre
- [ ] Form de Cliente (`ClientForm.tsx`) atualizado:
  - Section "Identificação" (name + legal_name + CNPJ + IE)
  - Section "Contato" (nome + email + telefone)
  - Section "Endereço" (7 campos colapsáveis ou em grid)
  - Section "Observações" (notes existente)
- [ ] Página `/clients/[id]` ganha bloco "Resumo" antes da lista de Operações:
  - MetricCard "Operações ativas" (count operations where archived_at IS NULL AND client_id=...)
  - MetricCard "Operações arquivadas" (count archived)
  - MetricCard "Frentes ativas" (count frentes WHERE archived_at IS NULL via join operations)
  - MetricCard "MRR total" — **admin only** (Inv. 14; pra member fica oculto)
- [ ] Display dos novos campos no `/clients/[id]` (PJ + contato + endereço) em section dedicada
- [ ] DATABASE_SCHEMA.md atualizado
- [ ] Sem alteração em RLS (campos novos, mesma política `authenticated_full`)
- [ ] Sem impacto em `/public/[token]` (cadastro PJ é interno)

## Out of Scope

- **Validação CNPJ com dígito verificador** — só 14 dígitos format check (decisão tomada)
- **FK pra `persons` external como contato** — texto livre (decisão tomada)
- **Endereço JSONB** — colunas planas (decisão tomada)
- **Consulta automática ReceitaWS** — usuário preenche manualmente
- **Múltiplos contatos por Cliente** — 1 contato principal só; mais virá futuro
- **Histórico de mudança** — `updated_at` cobre; sem audit log
- **Upload de contrato/documento** — anexos vivem em Operação (princípio existente)
- **Autocomplete via CEP (ViaCEP)** — sem dependência externa no MVP
- **CNPJ único** — sem UNIQUE constraint (mesmo grupo pode ter múltiplos cadastros propositais)
- **Inscrição municipal** — fora; só estadual
- **Tipo de pessoa PF vs PJ** — todo Cliente é PJ na DRYOS hoje; sem discriminador
- **Resumo no `/clients` (lista)** — só na página de detalhe `/clients/[id]`
- **Card MRR visível pra member** — admin only (Inv. 14)

---

## User Stories

### P1: Migration + schema ⭐ MVP

**Acceptance Criteria**:
1. Migration `<ts>_clients_enrich.sql` adiciona 13 colunas (todas nullable) via `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`
2. CHECK: `cnpj IS NULL OR char_length(cnpj) = 14`
3. CHECK: `address_state IS NULL OR char_length(address_state) = 2`
4. CHECK: `address_zip IS NULL OR char_length(address_zip) = 8`
5. CHECK email regex simples (`primary_contact_email IS NULL OR primary_contact_email LIKE '%_@_%.%'`)
6. COMMENT ON COLUMN em campos não-óbvios
7. Sem default value (todos nullable, dados retrofitam quando user editar)

---

### P1: Validador + actions ⭐ MVP

**Acceptance Criteria**:
1. `src/lib/validators/client.ts` atualizado:
   - `legal_name`: optional text max 200
   - `cnpj`: optional regex `/^\d{14}$/` (após strip de máscara no input)
   - `inscricao_estadual`: optional text max 30
   - `primary_contact_name`: optional text max 100
   - `primary_contact_email`: optional email
   - `primary_contact_phone`: optional text max 30
   - `address_*`: optional text com tamanhos sensatos; `state` 2 chars; `zip` 8 dígitos
2. `createClientAction` + `updateClientAction` aceitam novos campos
3. FormData parsing strip máscara CNPJ/CEP (só dígitos) antes de validar
4. Erro de validação retorna code `validation_<campo>` pro front grudar inline

---

### P1: ClientForm com sections ⭐ MVP

**Acceptance Criteria**:
1. `ClientForm.tsx` (client component) com 4 sections visuais:
   - Identificação: name (já existia), legal_name, CNPJ (input com máscara `99.999.999/9999-99`), IE
   - Contato: nome, email, phone (sem máscara — variação BR/internacional)
   - Endereço: 7 campos em grid (street + number em row, complement, district, city + state, zip)
   - Observações: notes (já existia)
2. CNPJ input mostra máscara mas envia só dígitos
3. CEP idem (máscara `99999-999`)
4. UF: select com 27 UFs OU input livre 2 chars (decisão: select pra evitar lixo)
5. Botões salvar/cancelar continuam onde tão hoje

---

### P1: Resumo + display em `/clients/[id]` ⭐ MVP

**Acceptance Criteria**:
1. Header da página continua igual (PageHeader)
2. Section "Resumo" nova ANTES da lista de Operações:
   - Grid de 3 MetricCards pra member: ativas / arquivadas / frentes ativas
   - Grid de 4 MetricCards pra admin: + MRR total (R$ formatado)
   - Layout responsivo `grid-cols-2 md:grid-cols-3 lg:grid-cols-4`
3. Section "Identificação & Contato" nova:
   - Bloco PJ: legal_name, CNPJ (formatado), IE
   - Bloco Contato: nome + email mailto: + phone tel:
   - Bloco Endereço: linhas formatadas (street, number complement / district / city - UF / CEP)
   - Empty state em cada bloco se nenhum campo preenchido ("— sem dados —" ou esconder bloco)
4. Lista de Operações continua depois (sem mudança)

---

### P1: Queries agregadas ⭐ MVP

**Acceptance Criteria**:
1. `src/lib/db/queries/clients.ts` ganha:
   - `getClientSummary(clientId)` retorna `{ activeOps, archivedOps, activeFrentes, mrrTotal }`
2. Query única ou Promise.all de 4 counts; reusar lógica de `getDashboardSummary` (count head:true patterns)
3. `mrrTotal` calculado server-side mas só passado pro componente filho se `isAdmin`

---

### P2: Autocomplete via CEP

Pula. Manual no MVP.

### P3: ReceitaWS consulta CNPJ

Pula.

---

## Edge Cases

- **CNPJ duplicado entre Clientes** → permitido (sem UNIQUE)
- **CNPJ com máscara colado no input** → strip dígitos antes de validar
- **CNPJ 11 dígitos (CPF)** → rejeita: validador exige 14
- **Endereço incompleto** (só cidade preenchida) → permitido (todos nullable)
- **UF inválida ("XX")** → rejeitada pelo select (limita a 27 opções)
- **CEP com hífen** → strip antes de validar
- **Email malformado** → rejeitado pelo Zod
- **Empty state**: section "Identificação & Contato" só renderiza blocos com pelo menos 1 campo preenchido (não polui o detalhe se Cliente legado sem dados)
- **MRR pra member**: oculto. Não vaza via prop drilling — `isAdmin` checado antes de passar o valor

---

## Success Criteria

- [ ] Migration aplicada; types regenerados
- [ ] Build verde
- [ ] Form de novo Cliente aceita todos os campos novos
- [ ] Form de edit pré-popula campos existentes
- [ ] CNPJ exibido formatado em `/clients/[id]`
- [ ] Resumo: contagens batem com SQL manual
- [ ] Admin vê MRR; member não
- [ ] Validação CNPJ rejeita ≠ 14 dígitos
- [ ] DATABASE_SCHEMA.md atualizado
- [ ] Smoke preview: criar Cliente novo com tudo, editar, ver detalhe

---

## Decisões de Domínio Pré-Design

| Questão | Decisão | Razão |
|---|---|---|
| `legal_name` separado de `name` | Sim | `name` = fantasia; `legal_name` = razão social. Distinção fiscal |
| Contato pessoa | Texto livre (3 colunas) | Simples; sem dep prévia de cadastro em /persons |
| Endereço | Colunas planas (7) | Buscas/exibição simples |
| CNPJ validação | Só formato (14 dígitos) | Decisão usuário; DV fica fora MVP |
| Armazenamento CNPJ | Só dígitos | Sem máscara no banco; format no display |
| Armazenamento CEP | Só dígitos | Mesma lógica |
| UF | Select com 27 UFs | Evita lixo "São Paulo" no campo de UF |
| CNPJ UNIQUE | Não | Grupo pode ter múltiplos cadastros |
| Tipo pessoa (PF/PJ) | Sem discriminador | Cliente DRYOS é sempre PJ |
| MRR no resumo | Sim, admin only | Inv. 14 |
| Resumo em `/clients` lista | Não | Só na página de detalhe |
| Page principal | `/clients/[id]` (existente) | Sem rota nova |
| Public link mostra cadastro PJ | Não | Interno |
| Audit log mudanças | Não | `updated_at` cobre MVP |
| Anexo de contrato | Não | Vive em Operação |
| Múltiplos contatos | Não | 1 principal MVP |
| Histórico razão social | Não | Sem audit log |
| Resumo: queries layer | `getClientSummary` em queries/clients.ts | Reuso de pattern |
| Card MRR | MetricCard existente | Reuso |
