# frentes-crud Specification

## Problem Statement

Frentes são o coração operacional do produto — onde mora o status acionável (princípio 04), o ciclo (A/B/C/D/E) e a alocação de pessoas. Hoje só existem via seed; o detalhe da Operação mostra as Frentes em modo somente-leitura. Sem CRUD, a tela mostra dados antigos pra sempre.

Esta feature entrega CRUD completo, contextual à Operação (sem rota standalone `/frentes`), com:

1. Botão "Nova Frente" no header da seção em `/operations/[id]`
2. Linha clicável por Frente → `/operations/[id]/frentes/[fid]/edit`
3. Auto-update do `actionable_status_since` quando o texto do status muda
4. Validação espelhada client+server do status acionável (princípio 04 + invariante 4)
5. Select de Responsável (internal persons; query nova `listInternalPersons()`)

## Goals

- [ ] Usuário consegue criar Frente em `/operations/[id]/frentes/new`, preenchendo nome, ciclo, domínio, fase, status acionável (validado), responsável e datas
- [ ] Editar em `/operations/[id]/frentes/[fid]/edit`; arquivar com guard (não há "ativas dependentes" de Frente; arquive direto, mas com confirmação)
- [ ] `actionable_status_since` é tocado automaticamente quando o texto do status acionável muda (e só quando muda)
- [ ] Sidebar não muda (Frentes não tem rota dedicada nem contagem global — vivem dentro de Operações)

## Out of Scope

- **State machine** rígida de `phase` (descoberta → execucao → entrega → encerrada) — select livre por enquanto; transições não-monotônicas permitidas
- **State machine** de `cycle_type` (A → B promoção, B com cláusula de evolução) — select livre
- **Alocações dentro do form** — feature `allocations-crud` separada; campo "Responsável" é um shortcut único
- **Briefing vivo, anexos, decisões** — features sem 03
- **Rota standalone `/frentes`** — Frentes só vivem no contexto de uma Operação
- **Pill de contagem na sidebar** — sem rota dedicada, sem contagem
- **Histórico de status acionável** — só guarda o atual + `since`; histórico vira tabela própria se houver demanda
- **Bulk archive** — feature avançada

---

## User Stories

### P1: Criar Frente dentro da Operação ⭐ MVP

**User Story**: Como admin, quero clicar "Nova Frente" no detalhe da Operação, preencher form com ciclo + domínio + status acionável, e ver a Frente aparecer na seção.

**Why P1**: Block sem isso.

**Acceptance Criteria**:

1. WHEN o user visita `/operations/[id]` THEN o header de "Frentes" SHALL ter um Link `<Button variant="sage"><Plus /> Nova Frente</Button>` ao lado da contagem em pill, levando pra `/operations/[id]/frentes/new`
2. WHEN o user visita `/operations/[id]/frentes/new` THEN SHALL renderizar form com:
   - **Nome** (text, required, ex: "Infra", "Dados Analíticos")
   - **Tipo de ciclo** (select: A/B/C/D/E com labels "A — Finito puro", "B — Finito → recorrente", "C — Contínuo", "D — Episódico recorrente", "E — Manutenção"; required; default `a`)
   - **Domínio** (select: Infra / Dados Analíticos / Dados Técnicos; required; default `infra`)
   - **Fase** (select: descoberta/execução/entrega/encerrada; default `descoberta`)
   - **Status acionável** (textarea, required; validação espelhada do banco: ≥15 chars + NOT IN lista de genéricos)
   - **Responsável** (select opcional; options = internal persons; "—" pra null)
   - **Data de início** (date opcional)
   - **Data de fim** (date opcional; **helper** "Tipo C/E (contínuo) tipicamente não tem fim")
3. WHEN submete THEN Server Action `createFrenteAction(operationId, formData)` faz Zod parse + insert; em sucesso, `router.push('/operations/{id}')` e `router.refresh()`
4. Validações Zod do status acionável idênticas ao DB:
   - `min(15, 'Mínimo 15 caracteres')`
   - `.refine(s => !FORBIDDEN.includes(s.trim().toLowerCase()), 'Status muito genérico. Especifique: "aguardando X de Y desde Z"')`
   - `FORBIDDEN = ['em andamento', 'em revisão', 'pendente', 'a fazer', 'em progresso']`

**Independent Test**: Visitar `/operations/<acme>/frentes/new` → preencher "Dados Analíticos" + ciclo C + domínio dados_analiticos + status "aguardando login no looker desde 14/05" + Gabi como responsável → submit → cair em `/operations/<acme>` → ver nova Frente na seção.

---

### P1: Editar Frente + auto-update `since` ⭐ MVP

**User Story**: Como admin, quero clicar em "Editar" numa Frente, alterar campos, salvar. Quando eu mudar o texto do status acionável, o "desde" deve ser tocado automaticamente.

**Why P1**: Sem isso, o seed envelhece pra sempre.

**Acceptance Criteria**:

1. WHEN a `FrentesListSection` é renderizada THEN cada linha SHALL ter um link "Editar →" ou similar no canto direito, levando pra `/operations/[id]/frentes/[fid]/edit`
2. WHEN o user visita `/operations/[id]/frentes/[fid]/edit` THEN SHALL pré-preencher form com valores atuais
3. WHEN submete THEN `updateFrenteAction(fid, formData)` SHALL:
   - Buscar a Frente atual no DB
   - Comparar `current.actionable_status` (trimmed/lowercase) com `new.actionable_status` (trimmed/lowercase)
   - **Se diferente**: incluir `actionable_status_since: now()` no UPDATE
   - **Se igual**: NÃO mudar `actionable_status_since`
   - Update demais campos
4. Em sucesso, redirect `/operations/[id]`

**Independent Test**: Editar "Infra" da Acme; mudar só o nome pra "Infra & Deploy" sem tocar no status → após salvar, `actionable_status_since` permanece `2026-05-13`. Editar de novo, mudar o status pra "aguardando outra coisa do cliente" → `actionable_status_since` vira `now()`.

---

### P1: Arquivar Frente ⭐ MVP

**User Story**: Como admin, quero arquivar Frente que terminou, com confirmação.

**Why P1**: Sem isso, Operação acumula Frentes encerradas e o "Em operação" deixa de fazer sentido.

**Acceptance Criteria**:

1. Form de edit tem botão "Arquivar" (ghost critical) ao lado de Cancelar/Salvar
2. `window.confirm("Arquivar esta Frente?")` antes de chamar
3. `archiveFrenteAction(fid)`:
   - **Guard**: rejeita se existem allocations ativas. Erro: "Frente tem N alocações ativas. Arquive ou termine antes." (`has_active_allocations`)
   - Senão: setta `archived_at = now()` + redirect `/operations/[id]`
4. Após arquivar, Operação reflete contagem reduzida em `OperationsTable` (`activeFrentes`) e `Sidebar` (`operationsCount` não muda; mas a Op pode ficar sem Frente ativa)

---

### P1: Auto-disable end_date pra ciclo contínuo (UX) ⭐ MVP

**User Story**: Como admin, ao escolher ciclo C ou E, quero o form sinalizar que end_date não faz sentido.

**Why P1**: Princípio 03 ("Tipos C/E não têm fim"). UX defensiva evita inputs sem sentido.

**Acceptance Criteria**:

1. WHEN cycle_type é `c` OU `e` THEN input `end_date` SHALL ficar disabled + hint "Ciclo {C/E} é contínuo; sem data de fim."
2. WHEN ciclo muda de C/E pra A/B/D THEN end_date volta habilitado
3. WHEN ciclo é C/E e o user submete com end_date preenchido (state stale) THEN Zod `.refine` rejeita com mensagem "Ciclo C/E não pode ter data de fim. Remova-a."
4. **Não bloquear hard**: continua sendo possível arquivar e mudar tudo

---

### P1: Validação espelhada do status acionável ⭐ MVP

**User Story**: Como dev, quero a mesma regra do CHECK constraint no form, pra dar feedback imediato sem ida ao server.

**Why P1**: UX. O DB já valida; client-side é só pra economizar round-trip.

**Acceptance Criteria**:

1. Zod schema na validators/frente.ts inclui:
   ```typescript
   const FORBIDDEN = ['em andamento', 'em revisão', 'pendente', 'a fazer', 'em progresso'];
   actionable_status: z.string()
     .trim()
     .min(15, 'Mínimo 15 caracteres.')
     .refine(s => !FORBIDDEN.includes(s.toLowerCase()), 'Status muito genérico. Especifique no formato "aguardando X de Y desde Z".')
   ```
2. RHF com zodResolver mostra erro inline conforme o user digita (ou após submit, dependendo de `mode`)
3. Server Action também valida (defense-in-depth)

---

### P2: Update da FrentesListSection com botões Editar

**User Story**: Cada linha de Frente ganha um link/botão "Editar".

**Why P2**: P1 já cobre (linkando o nome ou row inteira). P2 vira polish se row não-clicável-toda.

**Acceptance Criteria**:

1. Row inteira clicável OU botão "Editar" explícito no canto direito (escolher uma)
2. Hover destaca

---

### P2: Sugestão automática do nome a partir do domínio

**User Story**: Selecionar domínio "Infra" sugere nome "Infra"; "Dados Analíticos" sugere "Dados Analíticos". Editável.

**Why P2**: Pequena ajuda; pattern já existe em OperationForm.

---

### P3: Histórico de status acionável (audit table)

**User Story**: Ver quem mudou o status quando e por quê.

**Why P3**: Demanda futura. Sem essa, só temos o atual + since.

---

## Edge Cases

- WHEN `id` da Operação OU `fid` é inválido (não-UUID) THEN page page 404 / redirect (mesma lógica de ops)
- WHEN Frente arquivada visitada em `/edit` THEN redirect `/operations/[id]`
- WHEN cycle_type C ou E + end_date preenchido (manual via state stale) THEN Zod rejeita
- WHEN responsible_person_id aponta pra Pessoa arquivada (cenário borda) THEN UPDATE/INSERT falha com FK; UI mostra "Responsável inválido." Workaround: deselecionar
- WHEN não há internal persons no banco THEN select mostra só "—" e nota "Crie Pessoas internas pra atribuir responsável" (placeholder até persons-crud)
- WHEN o status acionável tem só whitespace pós-trim THEN Zod min(15) bloqueia (trim primeiro, depois min)

---

## Success Criteria

- [ ] `npm run typecheck` + `build` verdes
- [ ] Criar Frente em Acme: "Dados Analíticos" / ciclo C / domínio dados_analiticos / status válido → aparece em `/operations/<acme>` em <1s após redirect
- [ ] Editar a Frente Infra original; mudar só nome → `actionable_status_since` mantém. Mudar status → `since` vira agora.
- [ ] Tentar usar status "em andamento" → mensagem inline imediata (client) + server também rejeita se passar
- [ ] Selecionar ciclo C → end_date fica disabled + hint
- [ ] Arquivar Frente sem allocations → some da lista. Arquivar com allocations → mensagem amigável.
- [ ] Visual confere com `FrentesListSection` atualizada (botão Editar por linha + botão Nova Frente no header)
