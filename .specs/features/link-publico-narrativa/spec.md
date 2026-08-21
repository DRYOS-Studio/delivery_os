# link-publico-narrativa Specification

**Issue:** [#67](https://github.com/rafaelemeth/delivery_os/issues/67)
**Mockup canônico:** `docs/mockup-v2.html` → section `#screen-public` (linhas 3053–3295)

## Problem Statement

O link público (`/public/[token]`) hoje tem Hero compacto, Vilões em luta, Conquistas recentes e tabs (Frentes, Reuniões, Anexos, SLA). Falta a narrativa premium que justifica recorrência: **header com identidade de relatório**, **hero storytelling** com headline destacando o vilão de maior progresso e stat lateral comparando o mês, **narrativa específica por vilão naquela Operação naquele mês**, **conquistas filtradas pelo mês corrente**, **próximos movimentos** (tasks + reuniões agendadas) e **time alocado**. Sem isso, o link parece um dashboard interno exposto, não um relatório de produto premium.

Esta feature transforma a aba "Visão" do link público no relatório mensal narrativo do mockup. Tabs Frentes/Reuniões/Anexos/SLA continuam intactas como drill-down técnico.

## Goals

- [ ] Aba "Visão" do `/public/[token]` reproduz as 6 seções do mockup (Banner, Hero, Vilões, Conquistas, Próximos movimentos, Time)
- [ ] Narrativa por vilão é editável pelo time interno em `/operations/[id]` (aba Vilões), versionada por mês (`operation_villain_narratives`)
- [ ] Hero stat compara contagem de QWs do mês corrente vs mês anterior
- [ ] Light e dark mode mantêm fidelidade ao tratamento do mockup (cream/oak/sage; dark replica seção Core)

## Out of Scope

- **Selector de mês no link público** — link mostra mês corrente. Histórico de meses (URL `?month=2026-04`) entra na v2.
- **PDF download** — v2/future, conforme PRD.
- **Comentários do cliente** — fora do MVP, link é read-only.
- **Edição inline pelo cliente** — read-only.
- **Snapshot completo de progresso por mês** — só narrativa textual é versionada. Progresso atual (`progress_pct`) é live.
- **Email de invite com link** — fora desta feature.

---

## User Stories

### P1: Schema `operation_villain_narratives` ⭐ MVP

**User Story**: Como time interno, preciso de uma tabela onde registro a narrativa de cada vilão por mês naquela Operação, pra contar a história do progresso no relatório do cliente.

**Why P1**: Sem esse schema, a section "Vilões em luta" do relatório fica genérica (só mostra `villain.description` do catálogo, igual pra todo cliente). É o que diferencia "relatório premium" de "dashboard interno".

**Acceptance Criteria**:

1. WHEN migration roda, THEN tabela `operation_villain_narratives` SHALL existir com colunas: `id uuid PK`, `operation_id uuid NOT NULL FK CASCADE`, `villain_id uuid NOT NULL FK`, `period_yyyymm text NOT NULL CHECK (period_yyyymm ~ '^\d{4}-(0[1-9]|1[0-2])$')`, `narrative_text text NOT NULL CHECK (length(trim(narrative_text)) >= 20)`, `created_at`, `updated_at timestamptz default now()`
2. WHEN migration roda, THEN SHALL existir UNIQUE constraint `(operation_id, villain_id, period_yyyymm)` (1 narrativa por op×vilão×mês)
3. WHEN migration roda, THEN SHALL existir índice em `(operation_id, period_yyyymm)` pra read do relatório
4. WHEN migration roda, THEN RLS SHALL estar habilitada com policy `authenticated_full` (Inv. 12)
5. WHEN tabela é criada, THEN SHALL ter `COMMENT ON TABLE` explicando propósito e invariante
6. WHEN `npm run gen:types` roda, THEN os types do banco refletem a nova tabela

**Independent Test**: Aplicar migration via MCP `apply_migration` + verificar via `execute_sql` que insert válido passa, insert duplicado falha, insert com `period_yyyymm = '2026-13'` falha, insert com `narrative_text` curto falha.

---

### P1: UI admin pra editar narrativa por mês ⭐ MVP

**User Story**: Como Admin/Membro, na aba Vilões de `/operations/[id]`, vejo um botão "Editar narrativa do mês" em cada vilão ativo. Abre form pra escrever o texto da narrativa daquele vilão no mês corrente.

**Why P1**: Sem UI, schema fica órfão.

**Acceptance Criteria**:

1. WHEN abro aba Vilões de uma Operação, THEN em cada `OperationVillainCard` SHALL aparecer botão "Narrativa do mês" (oak link discreto)
2. WHEN clico o botão, THEN abre form/modal com textarea `narrative_text` (placeholder explicativo) + preview do mês corrente (ex: "Maio 2026")
3. WHEN salvo com `narrative_text` ≥ 20 chars, THEN SHALL persistir via Server Action retornando `ActionResult<{ id }>`
4. WHEN já existe narrativa pra `(op, vilão, mês corrente)`, THEN form vem pré-preenchido e save faz UPDATE (upsert via UNIQUE constraint)
5. WHEN texto < 20 chars, THEN form mostra erro de validação e não salva
6. WHEN não-autenticado tenta a action, THEN SHALL retornar `err('Sessão expirada.', 'unauthenticated')` (Inv. 14)

**Independent Test**: Logado, abro op, vou em Vilões, clico em "Narrativa do mês" de qualquer vilão, escrevo texto, salvo. Volto e vejo o texto preservado. Mês seguinte abro o mesmo vilão e form vem vazio (nova narrativa).

---

### P1: Banner header do relatório ⭐ MVP

**User Story**: Como cliente acessando o link público, vejo no topo um banner com logo DRYOS + título "Relatório de operação · `<Cliente>` · `<Mês Ano>`" que estabelece a identidade premium do documento.

**Why P1**: É a primeira coisa que o cliente vê. Sem banner, parece print de dashboard interno.

**Acceptance Criteria**:

1. WHEN acesso `/public/[token]`, THEN SHALL ver banner fixo no topo (acima das tabs) com:
   - Quadrado oak com letra "D" branca (logo)
   - "DRYOS" em font display semibold
   - Separator + texto: `Relatório de operação · <client_name> · <mês formatado em pt-BR>` (ex: "Maio 2026")
2. WHEN renderiza dark mode, THEN banner SHALL replicar tratamento Core (fundo escuro, oak vira sage)
3. WHEN cliente sem nome (edge), THEN SHALL mostrar nome da Operação como fallback no título

**Independent Test**: Abrir um link público de qualquer Operação → ver banner com logo + título com cliente e mês corrente.

---

### P1: Hero narrativo dinâmico ⭐ MVP

**User Story**: Como cliente, ao abrir o relatório vejo headline storytelling do tipo "O `<Vilão>` perdeu `<X>%` de força na sua operação" destacando o vilão de maior progresso atual, com lede de contexto e stat lateral comparando QWs do mês.

**Why P1**: É o gancho narrativo do relatório. Substitui o Hero estático atual.

**Acceptance Criteria**:

1. WHEN aba Visão renderiza, THEN SHALL identificar o vilão da Operação com **maior `progress_pct`** ativo (vilão não arquivado)
2. WHEN existe vilão com progresso > 0, THEN headline SHALL ser: `O <villain.name> perdeu <progress_pct>% de força na sua operação.` com `<progress_pct>%` envolto em `<em>` oak
3. WHEN não há vilão com progresso > 0 (op inicial), THEN headline SHALL ser fallback: `A jornada de transformação da sua operação acabou de começar.`
4. WHEN renderiza, THEN badge "Mês N de operação" SHALL aparecer acima da headline (calculado a partir de `operation.created_at` ou `operation.started_at`)
5. WHEN renderiza, THEN lede curta SHALL aparecer abaixo da headline: `Em <N> <meses|mês>, a DRYOS conduziu uma jornada de luta contra <K> dos 7 vilões da ineficiência operacional. Este é o relatório de <Mês>.` (K = vilões ativos na op)
6. WHEN renderiza, THEN stat lateral SHALL mostrar:
   - Label: "Quick wins · `<Mês>`"
   - Value grande: contagem de QWs com `happened_at` no mês corrente
   - Sub: `+<delta> vs <Mês Anterior>` (delta = corrente − anterior, com sinal); SHALL exibir "—" se mês anterior não tem dados

**Independent Test**: Criar 2 vilões na op (um com 62% progresso, outro com 30%), criar 3 QWs no mês corrente e 1 no mês anterior, abrir link público → headline cita o de 62%, stat mostra "3 · +2 vs Abril".

---

### P1: Vilões em luta com narrativa por mês ⭐ MVP

**User Story**: Como cliente, vejo cada vilão ativo da Operação com **a narrativa que o time escreveu pra aquele mês** (não a descrição genérica do catálogo), severidade inicial, e progress bar.

**Why P1**: É o coração da narrativa. Cada relatório precisa contar uma história específica daquela Operação, não regurgitar o catálogo.

**Acceptance Criteria**:

1. WHEN aba Visão renderiza, THEN SHALL listar vilões da Operação ordenados por `progress_pct` desc (maior primeiro)
2. WHEN vilão tem narrativa registrada pro mês corrente em `operation_villain_narratives`, THEN SHALL exibir `narrative_text` no card
3. WHEN vilão **não** tem narrativa pro mês corrente, THEN SHALL fazer fallback pro `villain.description` (catálogo) — mas sem destaque visual de "personalizado"
4. WHEN renderiza card, THEN SHALL conter: avatar com ícone+cor do vilão, nome em font display, pill de severidade inicial (formato "Severidade inicial: `<LABEL>`"), narrativa, barra de progresso com fill da %, coluna lateral com "`<X>%` derrotado"
5. WHEN vilão está arquivado MAS tem progresso registrado em `operation_villains`, THEN SHALL aparecer no relatório (preserva histórico — não some)
6. WHEN o vilão é arquivado E nunca teve progresso (`progress_pct = 0`), THEN SHALL ser omitido

**Independent Test**: Op com 3 vilões. Escrever narrativa de Maio só pros vilões A e B. Abrir relatório → A e B mostram narrativa custom, C mostra description do catálogo. Verificar ordenação por progresso desc.

---

### P1: Conquistas do mês ⭐ MVP

**User Story**: Como cliente, vejo as Quick Wins entregues **no mês corrente** com data, descrição e impacto por vilão.

**Why P1**: É a prova material da entrega do mês.

**Acceptance Criteria**:

1. WHEN aba Visão renderiza, THEN SHALL listar QWs com `happened_at` no mês corrente, ordenadas por data desc
2. WHEN renderiza header, THEN SHALL mostrar "Conquistas do mês" + meta com mês + contagem (ex: "Maio · 4 quick wins")
3. WHEN não há QWs no mês corrente, THEN SHALL renderizar mensagem discreta: "Nenhuma conquista registrada em `<Mês>`. As próximas chegam logo." (ou similar)
4. WHEN renderiza card de QW, THEN SHALL conter: ícone + data (formato dd/MM), título, descrição, pills de impacto (`<Vilão> +<X>%` em sage)
5. WHEN QW não tem impacts, THEN pills de impacto SHALL ser omitidas (card mostra só título/desc/data)

**Independent Test**: Op com 5 QWs distribuídas em 2 meses → relatório mostra só as do mês corrente, na ordem certa.

---

### P1: Próximos movimentos ⭐ MVP

**User Story**: Como cliente, vejo lista numerada (até 4) dos próximos passos da minha operação — tasks com prazo e reuniões agendadas.

**Why P1**: Fecha o ciclo do relatório com forward-looking.

**Acceptance Criteria**:

1. WHEN aba Visão renderiza, THEN SHALL agregar: (a) tasks da Operação (via Frentes) com `due_date >= hoje` E status não-concluído; (b) meetings da Operação com `meeting_at >= hoje` E `visibility = 'cliente'`
2. WHEN une as duas fontes, THEN SHALL ordenar por data ASC e pegar os **primeiros 4 items**
3. WHEN renderiza item, THEN SHALL ter: número grande à esquerda (1, 2, 3, 4), texto descritivo (task.title ou meeting.title), ETA formatado à direita
4. WHEN ETA é hoje, THEN SHALL mostrar "Hoje"; WHEN é amanhã, "Amanhã"; WHEN é nesta semana, "Sex" (dia da semana); WHEN é além, "DD/MM"
5. WHEN não há tasks nem meetings futuras, THEN section SHALL ser omitida (não renderizar header vazio)

**Independent Test**: Criar 2 tasks (uma daqui 3 dias, outra daqui 10) + 1 meeting (daqui 5 dias) → relatório mostra os 3 na ordem certa.

---

### P1: Quem cuida da sua operação ⭐ MVP

**User Story**: Como cliente, vejo cards das pessoas alocadas na minha operação (internas DRYOS e externas do meu time), humanizando o relatório.

**Why P1**: Encerra o relatório com identidade humana.

**Acceptance Criteria**:

1. WHEN aba Visão renderiza, THEN SHALL listar pessoas via `allocations` ativas (start ≤ hoje, end IS NULL OR end > hoje) join `persons` (não arquivadas)
2. WHEN renderiza card, THEN SHALL ter: avatar com inicial (cor por hash do nome ou por role), nome, role/especialidade (`person.specialty` se internal; `person.external_role` se external)
3. WHEN não há alocações ativas, THEN section SHALL ser omitida
4. WHEN renderiza, THEN header SHALL mostrar "Quem cuida da sua operação" + meta com contagem (ex: "4 pessoas")

**Independent Test**: Op com 3 alocações ativas (2 internal + 1 external) → 3 cards mostram nomes/roles corretos.

---

### P2: Selector de mês

**User Story**: Como cliente, posso navegar para relatórios de meses anteriores via `?month=YYYY-MM`.

**Why P2**: Útil pra cliente revisitar histórico, mas MVP basta mês corrente.

**Acceptance Criteria**:

1. WHEN `searchParams.month` está presente e é válido (`YYYY-MM`), THEN relatório SHALL renderizar dados daquele mês (narrativas, QWs, hero stat)
2. WHEN mês inválido ou futuro, THEN SHALL redirecionar pra mês corrente
3. WHEN renderiza, THEN UI SHALL mostrar setas "‹ Mês anterior" / "Próximo mês ›" no banner ou perto do hero

---

### P3: Snapshot completo de relatório

**User Story**: Como sistema, congelo progresso (não só narrativa) por mês pra que relatórios passados não mudem retroativamente.

**Why P3**: Premium real, mas complexo. MVP aceita que progresso é live (relatório de Abril visto em Maio mostra progresso atual).

---

## Edge Cases

- WHEN operação não tem cliente (edge raro — invariante deveria proteger), THEN banner SHALL mostrar nome da Operação como fallback no título
- WHEN operação não tem `created_at` ou `started_at` válido, THEN badge "Mês N" SHALL mostrar "Mês —"
- WHEN narrativa de vilão excede 800 chars, THEN UI SHALL renderizar truncate visual em mobile com "ver mais" (mas backend não trunca)
- WHEN dois vilões empatam em `progress_pct`, THEN hero SHALL pegar o de maior severidade inicial; se ainda empata, pega o de criação mais antiga (`created_at` asc)
- WHEN cliente acessa link revogado ou expirado, THEN `notFound()` (já funciona)
- WHEN período do relatório (mês corrente) tem 0 QWs E 0 tasks/meetings futuras E 0 vilões com progresso, THEN relatório SHALL renderizar só Banner + Hero (com fallback "jornada acabou de começar") + Time se houver alocações

---

## Success Criteria

- [ ] Abrir `/public/[token]` de qualquer Operação ativa mostra as 6 seções na ordem do mockup
- [ ] Layout fiel ao `docs/mockup-v2.html#screen-public` em light e dark mode
- [ ] Admin consegue editar narrativa de qualquer vilão em < 30s e ver refletido no link público
- [ ] Hero stat de QWs do mês confere com count manual no banco
- [ ] Tabs Frentes/Reuniões/Anexos/SLA continuam funcionando como drill-down (zero regressão)
- [ ] Lighthouse Accessibility ≥ 90 na página pública (texto contrast, alt text em ícones)
