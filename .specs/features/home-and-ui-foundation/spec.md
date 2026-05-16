# home-and-ui-foundation Specification

## Problem Statement

Hoje o app autenticado mostra um placeholder "DRYOS Delivery — semana 01 · setup" + e-mail logado + botão sair. Quem entra não vê o produto. Falta:

- Componentes base do DS (Pill, Card, Button, Icon) que toda tela depende
- Sidebar + PageHeader (chassi de layout)
- A primeira tela de produto: **Home com lista de Operações em cards**, mostrando linha de produto, status, nome do cliente, status acionável e time alocado
- Dados-semente pra render fazer sentido (sem isso a Home seria vazia até o `operations-crud` da semana 02 avançada)

Resolver isso simultaneamente entrega valor visual num único PR — você abre o site e vê o DRYOS Delivery como produto, não como bootstrap.

## Goals

- [ ] Usuário autenticado abre `/` e vê **Sidebar + Home com 3 Operações em cards**, todas seguindo DS v2 (tokens, fontes, pills, radius). Visual confere com `docs/mockup-v2.html`.
- [ ] Pelo menos 5 componentes UI canônicos (`Pill`, `Card`, `Button`, `Icon`, `Sidebar`, `PageHeader`, `OperationCard`) existem em `src/components/` e seguem skill `dryos-design-system`.
- [ ] Seed idempotente em `supabase/seed/` cria 3 Clientes + 3 Operações + 3 Frentes + 2 Pessoas + 3 Alocações; aplicável via MCP `execute_sql`. Schema da semana 01 não é alterado.

## Out of Scope

- **Operação aberta** (`/operations/[id]`) — feature separada (sem 02/03). Cards não navegam ainda — clique não faz nada ou navega pra placeholder.
- **CRUD UI** (criar/editar Operação, Cliente, etc) — features `clients-crud`, `operations-crud`, etc na sem 02.
- **Avatar component + footer com avatares no card** — `Avatar` precisa de `Person` real; defere pra `persons-crud`. Footer do card mostra contagem "X pessoas".
- **KpiCard, VillainCard, MeetingTimeline** — só usados em telas que ainda não existem.
- **Tabs com filtragem real** — visual estático na semana 02; filtragem é truque pequeno mas adicional. Por hora **renderiza só "Em operação"** com contagem dinâmica.
- **Hero da Operação, gradients oak, modo escuro** — não nesta tela; vão na Operação aberta + sem 05.
- **Reveal animations** (`useReveal`) — defere; entra junto com a Operação aberta.
- **Responsivo mobile fino** — UI desktop-first por enquanto. Quebra elegantemente no mobile mas não é foco.

---

## User Stories

### P1: Componentes UI canônicos básicos ⭐ MVP

**User Story**: Como dev, quero `Pill`, `Card`, `Button`, `Icon` em `src/components/ui/`, pra parar de escrever Tailwind direto em toda tela e ter consistência visual.

**Why P1**: Sem isso a Home vira soup de classes. Bloqueia toda UI futura.

**Acceptance Criteria**:

1. WHEN o dev importa `<Pill variant="oak">Core</Pill>` THEN SHALL renderizar pílula com `bg-oak-50 text-oak`, font-mono 10px, radius pill, padding correto. Variants: `neutral`, `oak`, `sage`, `ok`, `warning`, `critical`. Suporta `showDot` opcional.
2. WHEN o dev importa `<Card>...</Card>` THEN SHALL renderizar `bg-card border border-line rounded shadow-sm p-5`. Suporta prop `interactive` que adiciona `cursor-pointer hover:shadow-md hover:-translate-y-px hover:border-line-strong transition-all`.
3. WHEN o dev importa `<Button variant="primary">Click</Button>` THEN SHALL renderizar com classes per skill DS (variants: `primary` = `bg-ink text-bg hover:bg-oak`; `ghost` = `bg-card border border-line-strong text-ink-soft hover:bg-surface hover:border-ink`; `sage` = `bg-sage text-ink hover:bg-sage-deep hover:text-bg`). Size `sm` ou `md`.
4. WHEN o dev importa `<Icon>` THEN SHALL ser um wrapper minimalíssimo sobre Lucide — talvez sem necessidade de wrapper se for sempre `<AlertTriangle className="w-4 h-4" />`. **Decisão**: pular `<Icon>` wrapper; usar Lucide diretamente. Skip dessa story-line.
5. WHEN qualquer um desses componentes é usado em modo dark (`<body class="dark">`) THEN SHALL respeitar tokens dark sem ajustes especiais.

**Independent Test**: Criar uma `/_kitchen` (rota interna, devs only) que renderiza cada componente em todas as variantes. Visualmente conferir. (Opt-in: pode pular se for puxar demais; o test real é a Home usando os componentes.)

---

### P1: Sidebar + PageHeader ⭐ MVP

**User Story**: Como usuário interno, quero uma barra lateral fixa com logo + navegação + minha foto/nome + botão sair, e um cabeçalho de página com título e ações, pra navegar com clareza.

**Why P1**: Cada tela do mockup tem esse chassi; Home precisa dele desde o primeiro dia.

**Acceptance Criteria**:

1. WHEN usuário autenticado abre qualquer rota `/(app)/*` THEN SHALL ver `<Sidebar />` à esquerda fixa, largura ~220px, com:
   - Marca "DRYOS / Delivery" no topo (Funnel Display + Onest mono pra "Delivery")
   - Links de navegação: **Home** (`/`), **Catálogo** (`/catalog`, link existe mas página é placeholder por enquanto), **Painel** (`/admin`, idem). Apenas o link ativo recebe destaque (cor oak).
   - Footer com e-mail truncado + ícone `LogOut` clicável → dispara `signOutAction`
2. WHEN renderizado THEN SHALL usar tokens DS: `bg-surface` ou `bg-card`, `border-r border-line`, padding consistente.
3. WHEN o usuário visita `/` THEN SHALL ver `<PageHeader title="Bom dia, Rafael." subtitle="<X Operações ativas · Y em janela crítica>" actions={...} />` no topo do conteúdo.
4. WHEN o título do PageHeader é em Funnel Display 600 32px (h1) THEN o subtitle SHALL ser Onest 14px text-mute.
5. Não há `Avatar` ainda (pulado). Sidebar footer mostra só inicial do e-mail + e-mail truncado.

**Independent Test**: Navegar entre `/` e `/login`. Sidebar não aparece em `/login` (fora do route group). Reaparece em `/`. Clicar `LogOut` desloga.

---

### P1: Home com lista de Operações ⭐ MVP

**User Story**: Como usuário autenticado, quero abrir `/` e ver minhas Operações ativas em cards organizados em grid, pra ter um overview imediato.

**Why P1**: É a primeira tela de produto. Foi mostrada no mockup, é o que a sem 02 entrega.

**Acceptance Criteria**:

1. WHEN o usuário visita `/` autenticado THEN SHALL ver um grid de Operações (1 col mobile, 2 col tablet, 3 col desktop largo), renderizando todas as Operações não-arquivadas do banco (sem 1 entregou RLS; agora a query passa).
2. Cada Operação SHALL ser um `<OperationCard>` com:
   - Top: 2 pills lado a lado — `<Pill variant="oak">{linha_produto}</Pill>` (ex: Core, Spark, Studio) + `<Pill variant={status_color}>{status}</Pill>` (sage pra `em_operacao`, warning pra `janela_critica`, neutral pra `em_construcao`)
   - Meio: nome do cliente em **Funnel Display 600 20px**, nome da Operação em Onest 14px text-mute
   - Status acionável: primeiro `actionable_status` da primeira Frente associada — formato "aguardando X de Y" + "desde Z" (mono, text-mute)
   - Footer: contagem "X pessoas alocadas" + `<Pill variant="neutral">Tipo {cycle_type}</Pill>` da primeira Frente
3. WHEN não há Operações no banco THEN SHALL renderizar empty state: "Nenhuma Operação ativa. Aguarde o convite do admin ou abra uma nova."
4. WHEN há mais de uma Frente por Operação THEN o card mostra **a primeira** (ordenada por `created_at`) — não é a tela canônica pra ver todas; é overview.
5. WHEN o usuário **clica** num card THEN SHALL navegar pra `/operations/{id}` — página placeholder por enquanto (route existe, exibe "Em construção · sem 03").

**Independent Test**: Aplicar o seed (3 Operações). Visitar `/`. Ver 3 cards. Conferir tipografia + cores + pills baterem com mockup.

---

### P1: Seed de demonstração ⭐ MVP

**User Story**: Como dev/dono, quero poder rodar um seed que popula o banco com 3 Operações + dependências, pra eu ver a Home funcionando antes do CRUD existir.

**Why P1**: Sem dados, a Home renderiza vazia e a feature parece quebrada. Bloqueia validação do P1 anterior.

**Acceptance Criteria**:

1. WHEN o arquivo `supabase/seed/dev_demo.sql` é aplicado num banco com schema da sem 01 THEN SHALL criar:
   - 3 Clientes: `Acme`, `Beta`, `Gama` (slugs `acme`, `beta`, `gama`)
   - 3 Operações: 
     - `Acme Core` (linha `core`, status `em_operacao`, recurrence `mensal`)
     - `Beta Spark Inbox` (linha `spark`, status `em_operacao`)
     - `Gama Studio Launch — Edição 12` (linha `studio`, status `janela_critica`)
   - 3 Frentes (uma por Operação):
     - `Acme Core / Infra` (cycle `c`, domain `infra`, status acionável "aguardando aprovacao do briefing do cliente desde 13/05")
     - `Beta Spark Inbox / Infra` (cycle `c`, domain `infra`, status "aguardando handoff do design")
     - `Gama Studio Launch / Infra` (cycle `a`, domain `infra`, status "aguardando review do tech lead")
   - 2 Persons internas: `Rafael`, `Gabi` (kind=`internal`, specialty=`Engenharia` / `Marketing`)
   - 3 Allocations: Rafael+Acme(executor 40%), Rafael+Beta(executor 30%), Gabi+Gama(responsavel 50%)
2. WHEN o seed é re-executado THEN SHALL ser idempotente — `INSERT ... ON CONFLICT (slug) DO NOTHING` em clientes; e por nome+operation_id em frentes; etc.
3. WHEN o seed roda em DB com dados pré-existentes (clients/frentes com outros nomes) THEN SHALL apenas adicionar os novos, sem corromper o existente.

**Independent Test**: Aplicar via MCP `execute_sql`. Conferir `SELECT count(*) FROM clients` aumentou em 3 (ou ficou em 3+ se já tinha algo). Rodar de novo: count idêntico.

---

### P2: Tabs (visual estático com contagem dinâmica)

**User Story**: Como usuário, quero ver tabs "Em construção · Em operação · Janela crítica · Todas" com contagem em pill, mesmo que clicar não filtre ainda, pra entender que tem essa segmentação.

**Why P2**: Funcionalidade real (filtragem) é trivial mas adicional. Visualmente já comunica o estado.

**Acceptance Criteria**:

1. WHEN o usuário visita `/` THEN SHALL ver row de tabs acima do grid, com 4 tabs em pílula
2. Cada tab mostra contagem dinâmica em `<Pill variant="neutral">{count}</Pill>` ao lado do label
3. **Apenas "Em operação"** está ativa (destacada com `bg-card border border-ink-soft`); as outras são neutrais e **não clicáveis** nessa entrega
4. Implementação: contagens via aggregate query no Server Component

---

### P2: PageHeader com saudação contextual

**User Story**: "Bom dia, Rafael" + linha de contexto ("3 Operações ativas · 1 em janela crítica") — agradável de ver.

**Why P2**: Polimento. P1 funciona sem isso.

**Acceptance Criteria**:

1. Saudação varia por horário (`new Date().getHours() < 12 ? 'Bom dia' : <12-18 ? 'Boa tarde' : 'Boa noite'`)
2. Nome é primeiro segmento do e-mail antes do `@`, capitalizado (`rafaelemeth` → `Rafaelemeth`). Aceitável por enquanto; sem 02+ vai ter perfil com nome.
3. Subtítulo agrega contagens via Server Component query

---

### P3: Cards com hover real (não apenas `interactive` prop)

**User Story**: Hover de OperationCard levanta com shadow-md + translateY(-1px) per skill.

**Why P3**: `Card interactive` já cobre isso; é da spec do componente. Listei aqui só pra confirmar que aplica em OperationCard.

---

### P3: Rota `/_kitchen` com showcase de componentes

**User Story**: Página interna /_kitchen mostra todas variantes de Pill, Card, Button.

**Why P3**: Útil pra dev mas não necessário pro produto. Skip a menos que sobre tempo.

---

## Edge Cases

- WHEN não há Frentes em uma Operação THEN o card SHALL renderizar sem o status acionável e sem o pill de ciclo, mostrando placeholder "— sem Frente ativa" (não comum na prática, mas RLS permite).
- WHEN o usuário não tem permissão pra ver alguma Operação (RLS futura na sem 02 com profiles) THEN ela simplesmente não aparece — não é erro, é filtragem.
- WHEN o seed roda em DB onde Persons já existem com mesmos nomes THEN SHALL pular sem erro.
- WHEN a query do Server Component falha (DB down, etc) THEN SHALL renderizar estado de erro discreto: "Não foi possível carregar Operações. Tente novamente." com botão "Recarregar". **Sem stacktrace exposto.**
- WHEN o e-mail do user é null no PageHeader THEN saudação cai pra "Olá."

---

## Success Criteria

- [ ] `npm run build` verde
- [ ] `npm run typecheck` verde
- [ ] Visitar `https://delivery-os-phi.vercel.app/` autenticado → ver Sidebar + 3 cards de Operação
- [ ] Visual confere com `docs/mockup-v2.html` (cores, fontes, pills, espaçamento)
- [ ] Empty state aparece quando seed não foi aplicado
- [ ] Clique no card navega pra `/operations/{id}` (placeholder OK)
- [ ] Logout pela Sidebar funciona
- [ ] Re-aplicar seed não duplica dados
