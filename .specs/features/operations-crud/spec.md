# operations-crud Specification

## Problem Statement

Operações são o coração do produto (contrato comercial Core/Spark/Studio) mas hoje só existem via seed SQL. O time precisa criar/editar/arquivar Operações pela UI, e o detalhe atual é um placeholder ("Em construção · sem 03"). PRD §05 descreve a "Operação aberta" como **a tela mais rica do MVP** — hero oak com gradient sage, pills de linha/status, faixa de meta, vilões em luta, frentes, briefing, reuniões, financeiro, credenciais.

Esta feature entrega:
1. CRUD completo (create/edit/archive) com formulário tipado
2. Lista dedicada `/operations` em tabela (estilo `/clients`)
3. **Detalhe real `/operations/[id]`** seguindo o layout do mockup-v2, com seções "placeholder visíveis" pras features que ainda virão (vilões, briefing, reuniões, credenciais) — o usuário vê o esqueleto final desde já

Vai validar o pattern de detail-rich pages que outras entidades vão imitar.

## Goals

- [ ] Usuário consegue criar Operação via `/operations/new` com select de Cliente, linha, status, recorrência e MRR; cria e redireciona pro detalhe
- [ ] Tabela `/operations` com busca por nome ou cliente; sidebar com pill de contagem
- [ ] Detalhe `/operations/[id]` mostra hero (oak + gradient sage + cream text), pills, meta, seções Frentes + Financeiro + 4 placeholders ("Vilões", "Briefing", "Reuniões", "Credenciais") com mensagem "Em construção · sem X"
- [ ] Editar e arquivar funcionando com guards (não arquiva se há Frentes ativas)
- [ ] Botão "+ Nova operação" no PageHeader da Home

## Out of Scope

- **Vilões / Diagnóstico** — sem 04 (`villains-seed`, `diagnostic`, `operation-villains`)
- **Frentes CRUD** — `frentes-crud` na sequência. Esta feature **lista** frentes existentes no detalhe, mas não cria/edita.
- **Quick Wins** — sem 04
- **Briefing vivo** — sem 03 (`briefing-vivo`)
- **Reuniões + Decisões** — sem 03 (`meetings-decisions`)
- **Credenciais** — adiada per AD-009 (`bitwarden-integration` v2)
- **Anexos** — sem 03
- **SLA estruturado** — sem 03 (`sla`)
- **Link público** — sem 03 (`public-link-skeleton`)
- **Dark mode toggle** — final do MVP
- **Reveal animations** — final do MVP
- **Hero com `Modo escuro` button** — só visual no mockup; produto real não tem
- **Bulk actions** / **paginação** — fora do MVP

---

## User Stories

### P1: Lista `/operations` em tabela com busca ⭐ MVP

**User Story**: Como admin, quero ver todas as Operações em tabela densa em `/operations`, com busca, pra escanear rapidamente o portfólio.

**Why P1**: Home é overview com cards (3 colunas); admin precisa visão tabela densa pra escala.

**Acceptance Criteria**:

1. WHEN o user visita `/operations` autenticado THEN SHALL renderizar tabela com colunas:
   - **Cliente** (font-body 14px, text-ink) + slug abaixo em mono
   - **Operação** (nome em font-body)
   - **Linha** (pill oak)
   - **Status** (pill por variant)
   - **MRR** (mono, formato pt-BR "R$ 8.500,00" ou "—" se null)
   - **Frentes ativas** (pill neutral com contagem)
   - **Criado em** (mono DD/MM/YYYY)
   - **Ações** (link "Abrir →")
2. WHEN o user digita na busca THEN URL replace `/operations?q=<termo>` com debounce 300ms (reusa `useDebouncedValue`); server filtra `WHERE operations.name ILIKE %q% OR clients.name ILIKE %q%`
3. PageHeader: `title="Operações"` `subtitle="{N} ativas"` `actions={<Button variant="sage">+ Nova operação</Button>}` (link `/operations/new`)
4. Empty state diferenciado por `hasSearch` (igual a `/clients`)
5. Sidebar `Operações` link em "Espaço de trabalho" abaixo de "Clientes" com pill de contagem ativa

**Independent Test**: Aplicar seed → visitar `/operations` → ver 3 linhas. Buscar "studio" → fica só Gama. Sidebar marca Operações ativo.

---

### P1: Criar Operação ⭐ MVP

**User Story**: Como admin, quero clicar "+ Nova operação" e preencher form com Cliente + linha + nome + dados comerciais, pra criar Operação pela UI.

**Why P1**: Block sem isso.

**Acceptance Criteria**:

1. WHEN `/operations/new` é visitada THEN SHALL renderizar form com:
   - **Cliente** (select nativo, options = todos clients ativos ordenados por nome; required; "Selecione…" placeholder)
   - **Linha de produto** (select: Core / Spark / Studio; required)
   - **Nome da Operação** (input, required, ex: "Acme Core" — sugestão automática quando cliente + linha são selecionados: `<ClientName> <ProductLineLabel>`; pode ser editado manualmente)
   - **Status** (select: Em construção / Em operação; default `em_construcao`; "Janela crítica" e "Arquivada" não selecionáveis na criação — derivados/transição)
   - **Recorrência** (select opcional: mensal/trimestral/anual/única; "—" pra null)
   - **MRR** (input numérico, formato "R$ X.XXX,XX"; opcional; `numeric(14,2)` no DB; UI converte)
   - **Data de início** (date input; opcional)
   - **Data de fim** (date input; opcional; **helper**: "Frentes Tipo C/E (contínuo) não têm fim")
2. Validation via Zod `operationSchema`: required fields, MRR ≥ 0, end_date ≥ start_date quando ambos preenchidos
3. Server Action `createOperationAction(formData)` faz INSERT; em sucesso `ok({ id, name })`; em erro de validação → `err(msg, 'validation_<field>')`
4. Em sucesso, client `router.push('/operations/{id}')`
5. Botões "Criar operação" (primary) + "Cancelar" (ghost, volta pra `/operations`)

**Independent Test**: Visitar `/operations/new` → selecionar Acme + Core → ver nome auto preenchido "Acme Core" → ajustar MRR → submit → redirect pra detalhe da nova Op.

---

### P1: Detalhe `/operations/[id]` real (mockup-v2 esqueleto) ⭐ MVP

**User Story**: Como qualquer usuário interno, quero ver a página da Operação com layout final (hero oak, pills, meta, seções), mesmo que algumas seções estejam placeholder.

**Why P1**: É a tela mais rica e mais vendável. Mostrar agora mesmo que com sections incompletas dá tração de design.

**Acceptance Criteria**:

1. WHEN `/operations/[id]` é visitada THEN SHALL renderizar:
   - **Hero**: bloco oak (`bg-oak text-bg`) com gradient radial sage no canto top-right; padding `p-8 rounded-lg mb-6`; conteúdo:
     - Breadcrumb mono: `clientes / {client-slug} / operação`
     - Pill da linha em sage (variant sage on oak) + Pill de status (variante mapeada)
     - Nome do cliente em **Funnel Display 2.5rem (text-4xl) text-bg font-semibold**
     - Nome da operação em Onest 16px text-bg/70
     - Faixa de meta horizontal: 4-5 chips no formato `<label mono uppercase>` + `<value>`:
       - **Recorrência** (label) + valor (mensal/trim/anual/única ou "—")
       - **MRR** + valor "R$ 8.500,00" ou "—"
       - **Início** + DD/MM/YYYY ou "—"
       - **Fim** + DD/MM/YYYY ou "—"
       - **Criado** + DD/MM/YYYY
     - Actions: button "Editar" (variant ghost no oak, ajustar pra contrastar)
   - **Section "Vilões em luta"** — placeholder card com border-line + texto "Em construção · sem 04 · diagnostic + operation-villains"
   - **Section "Frentes"** — title + contagem em Pill; se há frentes: lista compacta (1 row por frente: nome + pill ciclo + pill domínio + status acionável truncado + responsável); se vazia: "Nenhuma Frente nesta Operação." + nota "Crie pelo CRUD de Frentes (sem 02 — próximo)"
   - **Section "Briefing vivo"** — placeholder com border-left sage + "Em construção · sem 03"
   - **Section "Reuniões e decisões"** — placeholder timeline "Em construção · sem 03"
   - **Section "Financeiro"** — 3 cards horizontais (KPI-style mas leve): MRR mensal, recorrência, contrato (início/fim). Se MRR null, card mostra "—" com label "Não recorrente"
   - **Section "Credenciais"** — placeholder "Em construção · v2 (adiada — AD-009)"
2. WHEN id inválido OR operação arquivada THEN `notFound()`
3. Hero respeita modo escuro futuro (mas não tem toggle agora)

**Independent Test**: Visitar `/operations/<acme-core-id>` → ver hero oak com "Acme" gigante + pill Core sage + pill Em operação + faixa meta com MRR R$ 8.500,00 etc. Sections placeholder mostram mensagens corretas. Section Frentes lista "Infra" (cycle C / domain Infra / status acionável).

---

### P1: Editar e arquivar Operação ⭐ MVP

**User Story**: Como admin, quero ajustar dados da Operação e arquivar quando terminar.

**Why P1**: Mesmo argumento de clients.

**Acceptance Criteria**:

1. WHEN `/operations/[id]/edit` é visitada THEN SHALL renderizar mesmo form do create com valores pré-preenchidos; **client_id** disabled (não pode trocar cliente — operação é vinculada ao cliente; pra trocar = nova operação)
2. Status select agora aceita todos os valores incluindo "Janela crítica" (mas não "Arquivada" — esse vem via botão dedicado)
3. WHEN salva THEN `updateOperationAction(id, formData)` retorna `ok({ id })`; client `router.push('/operations/{id}')`
4. WHEN clica "Arquivar" THEN `window.confirm` → `archiveOperationAction(id)` → `redirect('/operations')`
5. WHEN tenta arquivar Operação que tem Frentes não-arquivadas THEN `err('Operação tem N Frentes ativas. Arquive-as primeiro.', 'has_active_frentes')` (FK RESTRICT + UI guard)

---

### P1: Sidebar com Operações ⭐ MVP

**User Story**: Como user, quero "Operações" na sidebar pra navegar direto pra tabela.

**Acceptance Criteria**:

1. Sidebar `SidebarNav` ganha item "Operações" em "Espaço de trabalho", abaixo de "Clientes", com ícone `Briefcase` da Lucide e pill de contagem ativa
2. `Sidebar` Server Component agora carrega `clientsCount + operationsCount` em paralelo

---

### P1: Botão "+ Nova operação" na Home ⭐ MVP

**User Story**: Como user, quero criar nova Operação direto da Home, não só de /operations.

**Acceptance Criteria**:

1. Home PageHeader ganha `actions={<Link href="/operations/new"><Button variant="sage">+ Nova operação</Button></Link>}`

---

### P1: Card "Financeiro" no detalhe com sparkline (Recharts) ⭐ MVP

- Sparkline simples no card MRR mostrando os últimos 6 meses (mock data por enquanto, já que não temos histórico — array hardcoded a partir do MRR atual com variação ±10%; quando faturamento real existir, substitui)
- Cor sage com gradient sage→transparent abaixo
- Recharts será instalada nesta feature (vai virar dep central pro Painel Admin da sem 05)

### P2: Sugestão automática de nome da Operação

- Combo Cliente + Linha → ex: "Acme Core". Editável.

### P3: Hero com avatar inicial do cliente

- Pequeno avatar quadrado preto com inicial antes do nome (similar ao logo Sidebar). Polish.

### P3: Modo escuro toggle

- Out of scope MVP per ROADMAP.

---

## Edge Cases

- WHEN não há Clientes no banco THEN form de Operação mostra "Crie um Cliente primeiro" com link `/clients/new` em vez do select vazio
- WHEN MRR digitado com vírgula em vez de ponto THEN o input numérico aceita ambos; parse normaliza
- WHEN end_date < start_date THEN Zod rejeita
- WHEN id da URL não-UUID THEN 404 (mesmo padrão do clients)
- WHEN operação arquivada na URL THEN 404
- WHEN cliente da operação foi arquivado (caso teoricamente bloqueado pelo guard em archive client) THEN detalhe ainda renderiza, hero mostra cliente — mas slug do breadcrumb pode estar quebrado se navegar; trade-off aceitável

---

## Success Criteria

- [ ] Build + typecheck verdes
- [ ] `/operations` renderiza 3 linhas
- [ ] Criar nova "Acme Spark Inbox" → aparece na lista + na Home
- [ ] Detalhe da Acme Core mostra hero + meta + seções
- [ ] Editar status pra "Janela crítica" → home reflete
- [ ] Tentar arquivar Acme Core → bloqueia (tem frente)
- [ ] Sidebar: "Operações (4)" depois de criar a Spark Inbox extra
- [ ] Botão "+ Nova operação" na Home funciona
