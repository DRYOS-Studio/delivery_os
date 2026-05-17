# briefing-vivo Specification

## Problem Statement

Hoje uma Operação tem `name`, `client_id`, `product_line`, `monthly_recurring_revenue` — nada que descreva **o que ela é** em prosa: contexto do cliente, objetivos da entrega, escopo (in/out), premissas operacionais, riscos visíveis e quem decide o quê do lado cliente.

Sem briefing:
- Equipe DRYOS perde rationale da operação (onboarding de novo membro = arqueologia de Discord)
- Cliente externo, quando o link público existir (sem 03+), não vê narrativa
- Decisões posteriores ficam descontextualizadas — vilões diagnosticados (sem 04) não se ancoram em escopo declarado
- Stakeholders chave (decisores do cliente) ficam implícitos; ninguém sabe quem aprova o quê

Esta feature abre a **semana 03 (camada "vivos")**: o primeiro elemento narrativo persistido por trás dos CRUDs estruturais da sem 02. Apoia tudo que vem depois — reuniões referenciam objetivos do briefing, decisões revisam escopo, diagnóstico de vilões usa premissas como contraste.

## Goals

- [ ] Toda Operação tem **um briefing** acessível em `/operations/[id]/briefing`
- [ ] Briefing tem **seções fixas estruturadas** (cada uma é uma coluna `text` opcional): contexto, objetivos, escopo_incluido, escopo_excluido, premissas, riscos, stakeholders, observacoes
- [ ] Cada **save cria snapshot** em `briefing_versions` (versão completa do conteúdo + author_id + created_at)
- [ ] Hero/sidebar da Operação ganha link "Briefing" levando à rota
- [ ] Página do briefing mostra **conteúdo atual** + indicador "última atualização: X por Y" + ação "Histórico" abrindo lista de versões anteriores (cada uma com timestamp + author + preview)

## Out of Scope

- **Diff visual entre versões** — lista de versões mostra preview do conteúdo de cada, mas comparação lado-a-lado fica pra v2
- **Restore de versão antiga** — usuário pode copiar/colar manual; restore "1 clique" pula pro MVP
- **Markdown rendering rico** — campos são `text` puro (linhas e parágrafos); pode evoluir pra markdown depois
- **Co-edição simultânea** — write-last-wins; sem locking
- **Comentários inline** — feature separada (futuro)
- **Auto-save / draft** — usuário salva explicitamente
- **Validation tipo "objetivos sem palavras vagas"** — o conteúdo é livre; sem CHECK no banco que rejeite frases
- **Briefing pra Frente** (subnível) — só Operação tem briefing; Frente é executiva, não narrativa
- **Versão pública (link externo)** — virá quando feature `public-link-skeleton` for implementada; visibility separada cabe mas não no MVP desta feature

---

## User Stories

### P1: Visualizar briefing da Operação ⭐ MVP

**User Story**: Como admin, ao abrir `/operations/[id]/briefing`, quero ver o briefing estruturado da Operação em modo leitura, com cada seção destacada.

**Why P1**: Sem leitura primeiro, todo o resto é teoria.

**Acceptance Criteria**:

1. WHEN visita `/operations/[id]/briefing` THEN preload `getOperation(id) + getBriefing(operationId) + getLatestBriefingVersion(briefingId)` em paralelo. Se Operation inválida → redirect `/operations`.
2. Se briefing ainda não existe pra Operation:
   - Renderiza empty state: card centralizado "Esta Operação ainda não tem briefing." + CTA "Criar briefing" → leva à edit page (que cria on save)
3. Se existe:
   - PageHeader: `title="Briefing"` `subtitle="{Op.name} · {Client.name}"` + ação "Editar" (botão sage)
   - Subtitle pequena: "Atualizado em {data} por {autor}" + Link "Histórico ({N} versões)"
   - Body: cada seção como bloco `<section>` com `<h2>` (Funnel Display) + conteúdo (Onest, `whitespace-pre-wrap`). Seções vazias renderizam `<p class="text-mute italic">Sem conteúdo.</p>`
   - Ordem fixa: Contexto · Objetivos · Escopo incluído · Escopo excluído · Premissas · Riscos · Stakeholders · Observações

---

### P1: Criar/Editar briefing ⭐ MVP

**User Story**: Como admin, em `/operations/[id]/briefing/edit`, quero preencher/editar as 8 seções e salvar.

**Why P1**: Conteúdo entra por aqui.

**Acceptance Criteria**:

1. WHEN visita `.../briefing/edit` THEN preload Operation + getBriefing + getLatestBriefingVersion. Se briefing inexistir, form abre vazio.
2. Form `<BriefingForm>` com 8 textareas (rows=6 ou auto-resize):
   - **Contexto** — quem é o cliente, qual situação atual
   - **Objetivos** — o que a Operação precisa entregar (lista em prosa)
   - **Escopo incluído** — o que está dentro
   - **Escopo excluído** — o que está fora, com razão se necessário
   - **Premissas** — o que assumimos verdadeiro (acesso, recursos, prazos)
   - **Riscos** — visíveis no início; revisitados em reuniões/diagnóstico
   - **Stakeholders** — quem decide do lado cliente (nome + papel + e-mail livre em prosa, sem FK)
   - **Observações** — livre
3. Todos os campos **opcionais**; submit salva o que houver.
4. `saveBriefingAction(operationId, formData)`:
   - Guard auth
   - Zod parse (cada campo opcional, max 5000 chars)
   - UPSERT em `briefings` (1 registro por operation_id; coluna `operation_id` UNIQUE)
   - INSERT em `briefing_versions` com snapshot **completo** (todas as 8 colunas, mesmo vazias) + `author_id = auth.uid()`
5. Em sucesso → redirect `/operations/[id]/briefing`
6. PageHeader: `title="Editar briefing"` `subtitle="{Op.name} · {Client.name}"`

---

### P1: Snapshot por save ⭐ MVP

**User Story**: Como admin, cada save cria uma versão imutável; histórico nunca é editado.

**Why P1**: Coração da feature "vivo".

**Acceptance Criteria**:

1. Toda chamada de `saveBriefingAction` INSERT linha em `briefing_versions` com:
   - `briefing_id` FK
   - 8 colunas de conteúdo (snapshot completo do estado pós-save)
   - `author_id` (uuid do `auth.users` via `auth.uid()`)
   - `created_at` timestamptz default now
2. `briefing_versions` é write-only (sem UPDATE/DELETE no MVP). RLS rejeita UPDATE.
3. Briefing "atual" = MAX(created_at) das versões. Coluna conveniência em `briefings.current_version_id` opcional pra simplificar query; atualizada no mesmo INSERT da action via segunda chamada. (Decisão de design: ver design.md.)

---

### P1: Histórico de versões ⭐ MVP

**User Story**: Como admin, em `/operations/[id]/briefing/history`, quero ver lista de versões anteriores com data, autor, e preview.

**Why P1**: Sem histórico legível, snapshots viram dado morto.

**Acceptance Criteria**:

1. WHEN visita `.../briefing/history` THEN preload Operation + getBriefing + listBriefingVersions(briefingId, limit=50). Se sem briefing, redirect `/operations/[id]/briefing`.
2. Lista cronológica desc: cada linha
   - Pill com data relativa ("há 3 dias") + data absoluta mono
   - Avatar(sm) + nome do autor (lookup via auth.users.email; helper `getAuthorDisplay`)
   - Preview: primeiras ~120 chars de Contexto OU Objetivos (o que tiver) com ellipsis
   - Link "Ver versão completa" → `.../briefing/history/[vid]` (somente leitura, render igual ao P1)
3. Versão atual aparece no topo com Pill "Atual" (sage)

---

### P1: Link da Operation pra Briefing ⭐ MVP

**User Story**: Da `/operations/[id]`, quero acesso direto ao briefing.

**Acceptance Criteria**:

1. `OperationHero` (ou seção adjacente) ganha link/CTA "Briefing" → `/operations/[id]/briefing`
2. Quando briefing existe e tem ≥ 1 versão: Pill verde "Briefing vivo · atualizado há Xd"
3. Quando inexistente: Pill warning "Sem briefing"

---

### P2: Listar autor pelo email

Versões guardam `author_id` apontando pra `auth.users`. Helper server-side resolve `id → email`. Para MVP, mostrar email mesmo (não display name).

---

### P3: Restore de versão antiga

Ver versão antiga em modo "copiar dela": botão "Usar esta versão como base" pré-preenche o form de edit. Pula MVP.

---

## Edge Cases

- WHEN Operation arquivada THEN edit page redirect / ou mostra readonly. Decisão design: bloquear edit, permitir read.
- WHEN operação não tem briefing AND user vai direto pra `.../history` THEN redirect `.../briefing`
- WHEN versão referenciada por `current_version_id` é deletada (não deveria; RLS bloqueia) THEN fallback pra MAX(created_at)
- WHEN duas tabs salvam simultaneamente THEN write-last-wins; ambas geram versões; histórico preserva ambas
- WHEN texto > 5000 chars por campo THEN Zod rejeita inline
- WHEN author user deletado de auth.users posteriormente THEN `briefing_versions.author_id` fica órfão; `getAuthorDisplay` fallback "Usuário removido" (FK com `ON DELETE SET NULL`)
- WHEN concurrent edit causa version race THEN INSERTs em `briefing_versions` são append-only; sem conflito de PK (uuid). Última versão criada vence em current_version_id.

---

## Success Criteria

- [ ] typecheck + build verdes
- [ ] Acme/Core: criar briefing com pelo menos 3 seções preenchidas (contexto, objetivos, riscos)
- [ ] Salvar 2x com mudanças diferentes → ver 2 versões no histórico, autor correto
- [ ] Visitar versão antiga em `.../history/[vid]` → renderiza conteúdo da versão (não da atual)
- [ ] OperationHero mostra Pill "Briefing vivo · atualizado há 0d"
- [ ] Operação sem briefing mostra empty state + Pill warning no Hero
- [ ] RLS rejeita UPDATE/DELETE em `briefing_versions` (testar via SQL direto)
- [ ] Screenshots: briefing view (com conteúdo), briefing edit (form aberto), history (2+ versões), Hero atualizado

---

## Decisões de Domínio Pré-Design

| Questão | Decisão | Razão |
|---|---|---|
| Quantas seções fixas? | 8 (Contexto, Objetivos, Escopo incluído, Escopo excluído, Premissas, Riscos, Stakeholders, Observações) | Cobre 90% do que aparece em briefings reais; estruturado o suficiente pra ser consultável; flexível o suficiente pra não engessar |
| Snapshot completo ou diff? | Snapshot completo (8 colunas) | Simples, robusto; storage barato (text). Diff é otimização prematura |
| 1 briefing por Operation? | Sim, UNIQUE(operation_id) | Operação tem **um** briefing; mudanças = nova versão, não novo briefing |
| Author tracking? | author_id FK auth.users ON DELETE SET NULL | Histórico precisa preservar autoria mesmo se user sair |
| current_version_id na tabela briefings? | Sim, denormalizado | Evita JOIN+MAX em toda query de leitura. Atualizado no mesmo flow do INSERT version |
| Tamanho máx por campo? | 5000 chars (Zod, sem CHECK no banco) | Briefing é narrativa, não tese; força concisão sem ser opressivo |
| Restore? | Out of scope | Copy-paste funciona; UI dedicada vem se houver demanda |
| Markdown? | Não no MVP — text puro com `whitespace-pre-wrap` | Plain text é 80% do valor com 10% da complexidade |
| Visibility (interno/externo)? | Sem campo agora | Mesma decisão da Operação: pública por default no MVP; visibility entra com `public-link-skeleton` |
| Briefing de Frente? | Não | Frente é executiva (status acionável + alocações). Narrativa fica na Operação |
| Soft delete? | Não | Briefing some quando Operation é arquivada (via cascade); versões idem |
