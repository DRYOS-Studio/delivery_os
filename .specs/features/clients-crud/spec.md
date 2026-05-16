# clients-crud Specification

## Problem Statement

Hoje Clientes só existem via seed SQL. Pra a operação real do MVP funcionar, o time precisa criar, listar, buscar, editar e arquivar Clientes pela UI. Sem isso, qualquer Operação nova exige rodar SQL — nada escalável.

Esta feature entrega a primeira tela CRUD completa do sistema, validando o pattern (Server Actions com `ActionResult`, guards de auth, queries tipadas, formulários com Zod) que será reusado por `operations-crud`, `frentes-crud`, etc.

## Goals

- [ ] Usuário autenticado consegue navegar até `/clients`, ver lista de todos os Clientes não-arquivados em uma tabela com busca por nome ou slug, e criar/editar/arquivar Clientes via páginas dedicadas.
- [ ] Detalhe `/clients/[id]` mostra dados do Cliente + lista de Operações ativas + lista de Pessoas externas vinculadas, sem precisar de outras features CRUDs prontas pra que isso renderize.
- [ ] Padrão de mutation (`ActionResult` + Zod + guard de auth) emerge dessa feature como template pras próximas (operations, frentes, persons, allocations).

## Out of Scope

- **Criar Operação a partir do detalhe do Cliente** — feature `operations-crud` cuida disso. Detalhe do Cliente lista Operações já existentes mas não cria.
- **Criar Pessoa externa a partir do detalhe** — feature `persons-crud`. Detalhe lista as que já existem.
- **Restaurar Cliente arquivado / hard-delete** — soft-delete via `archived_at` apenas. Restore vira feature admin separada se necessário.
- **Upload de logo do Cliente** — sem coluna no schema; defere v2.
- **Histórico de alterações** — sem auditoria/journal table no MVP.
- **Paginação na lista** — busca server-side filtra; pra MVP de 5-20 clientes não há paginação. Adiciona quando passar de 100.
- **Bulk actions (selecionar vários, arquivar em lote)** — fora do MVP.
- **Validação assíncrona de slug único** — uniqueness é constraint do DB; o form mostra erro depois do submit (sem AJAX de "este slug já existe").
- **Reorganização visual da Sidebar com pill de contagem** — vai junto, mas só "Clientes" ganha contagem (Home, Catálogo, Painel ficam sem).

---

## User Stories

### P1: Lista de Clientes com busca ⭐ MVP

**User Story**: Como admin/membro, quero abrir `/clients` e ver uma tabela com todos os Clientes ativos, com input de busca no topo, pra encontrar rapidamente quem procuro.

**Why P1**: Sem isso, qualquer trabalho com Operações exige passar pelo SQL ou pelo seed.

**Acceptance Criteria**:

1. WHEN o usuário visita `/clients` (autenticado) THEN o servidor SHALL renderizar tabela com colunas:
   - **Nome** (font-body 14px, text-ink)
   - **Slug** (font-mono 12px, text-mute)
   - **Operações ativas** (contagem em Pill neutral)
   - **Pessoas externas** (contagem em Pill neutral)
   - **Criado em** (date BR mono, text-mute)
   - **Ações** (link "Abrir" pra `/clients/[id]`)
2. WHEN o usuário digita no input de busca THEN a página SHALL atualizar a URL para `/clients?q=<termo>` (via Server Action ou navegação) e re-renderizar com filtro server-side: `WHERE name ILIKE %q% OR slug ILIKE %q%`. **Debounce** ~300ms pra não disparar a cada tecla.
3. WHEN não há Clientes (ou query vazia) THEN SHALL mostrar empty state: "Nenhum Cliente cadastrado." + botão `Novo cliente` (sage).
4. WHEN há busca sem resultados THEN SHALL mostrar empty state: "Nenhum Cliente para '<q>'." + link "limpar busca".
5. Header da página: PageHeader `title="Clientes"` `subtitle="{N} Clientes ativos"` `actions={<Button variant="sage">Novo cliente</Button>}` — botão linka pra `/clients/new`.
6. WHEN um Cliente está arquivado (`archived_at IS NOT NULL`) THEN NÃO aparece na lista padrão. (Out of scope: toggle "mostrar arquivados".)

**Independent Test**: Visitar `/clients` com seed aplicado → ver tabela com Acme/Beta/Gama, 3 ops ativas total, 0 externas. Digitar "acm" → fica só Acme. Apagar busca → todos voltam.

---

### P1: Criar Cliente ⭐ MVP

**User Story**: Como admin, quero clicar em "Novo cliente", preencher form com nome + slug + notas, e ver o cliente aparecer na lista após submit.

**Why P1**: Block sem isso.

**Acceptance Criteria**:

1. WHEN o usuário visita `/clients/new` autenticado THEN SHALL renderizar form com 3 campos:
   - `name` (required, text input, autoFocus, min 1 char)
   - `slug` (required, text input, regex `^[a-z0-9-]+$`, min 1, max 60 chars; helper text "minúsculas, números e hífens")
   - `notes` (textarea, opcional, max 1000 chars)
2. Botão "Criar cliente" (`<Button variant="primary">`) + link "Cancelar" (`<Button variant="ghost">`).
3. WHEN o user submete THEN Server Action `createClientAction(formData)` SHALL:
   - Validar via Zod (`name` non-empty, `slug` regex)
   - Chamar guard `requireUserAction()`
   - INSERT em `clients`; em sucesso, `redirect('/clients/{id}')`
   - Em erro de slug duplicado (Postgres error 23505 unique_violation) → `err('Já existe Cliente com esse slug.', 'slug_taken')`
   - Outros erros DB → `dbErr(error, 'createClientAction')`
4. WHEN o form retorna erro THEN SHALL mostrar mensagem inline (`<p class="text-critical text-xs">`) ABAIXO do campo que causou o erro, ou geral no topo se for erro de DB.
5. Sugestão automática de slug a partir do nome: ao digitar "Acme Co.", o slug sugere "acme-co" (kebab-case, lowercase, sem acentos). Cliente pode editar manualmente.

**Independent Test**: Criar "Teste S.A." → slug auto vira "teste-s-a" → submit → redirect pra `/clients/{id}` → cliente aparece na lista.

---

### P1: Detalhe do Cliente com Operações e Pessoas ⭐ MVP

**User Story**: Como membro, quero abrir um Cliente e ver tudo que pertence a ele numa tela só — operações ativas + pessoas externas — pra contexto rápido.

**Why P1**: É o link público interno do Cliente; sem isso, navegação volta a SQL.

**Acceptance Criteria**:

1. WHEN o usuário visita `/clients/[id]` THEN SHALL renderizar:
   - PageHeader `title={client.name}` `subtitle="slug · criado em DD/MM"` `actions={<Button variant="ghost">Editar</Button>}` (link pra `/clients/[id]/edit`)
   - Se `client.notes` não-vazio: bloco com fundo sage suave + border-left sage + nota em font-body. Senão, omite.
   - Section "Operações" — h2 + contagem; grid de `<OperationCard>` (reusa componente). Empty state se zero: "Nenhuma Operação ativa pra este Cliente."
   - Section "Pessoas externas" — h2 + contagem; lista de cards/linhas: nome + papel externo + e-mail (se houver). Empty state se zero.
2. WHEN o `id` não existe ou Cliente está arquivado THEN SHALL renderizar 404 (`notFound()` do Next).

**Independent Test**: Visitar `/clients/<acme-id>` → ver "Acme" + slug "acme" + 1 operação (Acme Core) + 0 pessoas externas. Visitar `/clients/{uuid-inexistente}` → 404.

---

### P1: Editar e arquivar Cliente ⭐ MVP

**User Story**: Como admin, quero ajustar nome/slug/notas e poder arquivar (sumir da lista, sem deletar) um Cliente.

**Why P1**: Sem isso, erros de cadastro viram dado permanente.

**Acceptance Criteria**:

1. WHEN o usuário visita `/clients/[id]/edit` THEN SHALL pré-preencher form com `name`, `slug`, `notes` atuais; mesmo schema de validação do create.
2. Botões: "Salvar" (primary), "Cancelar" (ghost, volta pra `/clients/[id]`), "Arquivar" (variant ghost com cor critical — destrutiva mas leve).
3. WHEN salva THEN `updateClientAction(id, formData)` retorna `ok` e redirect pra `/clients/[id]`. Mesma lógica de erro do create.
4. WHEN clica "Arquivar" THEN SHALL pedir confirmação (`window.confirm` é OK pra MVP) e chamar `archiveClientAction(id)` que setta `archived_at = now()`. Sucesso → redirect pra `/clients`.
5. WHEN tenta arquivar Cliente que tem Operações não-arquivadas THEN SHALL retornar `err('Cliente tem N Operações ativas. Arquive-as antes.', 'has_active_operations')`. (Defesa em camada — FK já protege com RESTRICT, mas a UI dá mensagem amigável.)
6. Slug pode ser editado — mas se houver Operação ativa, **NÃO permite mudar slug** (`err('Cliente tem Operações ativas; slug não pode mudar.', 'slug_locked')`). Razão: slug pode entrar em URLs públicas no futuro.

**Independent Test**: Editar nome "Acme" → "Acme Tech" → salvar. Tentar arquivar → bloqueia porque tem Operação ativa. Arquivar Operação primeiro (out of scope desta feature; mas via SQL): aí arquivar Cliente funciona.

---

### P1: Sidebar com link "Clientes" ⭐ MVP

**User Story**: Como usuário, quero navegar pra `/clients` direto da sidebar.

**Why P1**: A Home não navega pra Clientes; sem link na sidebar, é caminho cego.

**Acceptance Criteria**:

1. Sidebar (`SidebarNav`) SHALL adicionar item "Clientes" em "Espaço de trabalho", abaixo de "Home", com ícone `Users` da Lucide.
2. WHEN a contagem de Clientes ativos é >0 THEN SHALL mostrar pill com contagem ao lado do label. Implementação: contagem carregada via query no Server Component que envolve a Sidebar (move `Sidebar` pra ler contagem).
3. Active state: `bg-oak-50 text-oak` quando `pathname` começa com `/clients`.

---

### P2: Detalhe do Cliente — operações arquivadas em accordion

**User Story**: Como admin, quero ver operações arquivadas do Cliente colapsadas no fim da página, pra contexto histórico.

**Why P2**: Útil mas não essencial. P1 já cobre operações ativas.

**Acceptance Criteria**:

1. Section colapsada "Operações arquivadas (N)" que expande on click; lista em formato compacto.

---

### P2: Highlight do termo de busca

**User Story**: Como usuário, quero ver o termo da busca destacado nos resultados.

**Why P2**: Polimento.

---

### P3: Atalhos de teclado

**User Story**: "N" cria novo cliente, "/" foca busca, "Esc" cancela.

**Why P3**: Power-user.

---

## Edge Cases

- WHEN `slug` tem caracteres inválidos no submit THEN SHALL falhar validação Zod **antes** de chegar no DB; mensagem "Slug só pode ter minúsculas, números e hífens."
- WHEN dois admins criam clientes com mesmo slug em paralelo THEN o segundo recebe `err('Já existe Cliente com esse slug.', 'slug_taken')` (constraint unique).
- WHEN o user navega pra `/clients/[id]` com `id` malformado (não-UUID) THEN o Server Component captura e renderiza 404.
- WHEN o user tenta editar Cliente arquivado THEN SHALL redirecionar pra `/clients` (não permite editar arquivado pelo MVP).
- WHEN há 100+ Clientes (sem paginação ainda) THEN tabela renderiza tudo numa página só. Performance aceita até ~500; reavaliar com paginação depois.
- WHEN busca tem caracteres especiais SQL THEN SHALL escapar via parametrized query (Supabase client já faz). Nunca string interpolation.

---

## Success Criteria

- [ ] `npm run build` + `typecheck` verdes
- [ ] `/clients` renderiza 3 clientes do seed em <500ms
- [ ] Buscar "acm" filtra pra Acme; apagar restaura todos
- [ ] Criar "Teste S.A." com slug auto "teste-s-a" → cliente aparece na lista
- [ ] Editar "Acme" para "Acme Tech" → salvo
- [ ] Tentar arquivar Acme (tem op ativa) → mensagem bloqueia
- [ ] Detalhe de Acme mostra "Acme Core" como Operação
- [ ] Sidebar "Clientes" ativo quando em `/clients/*`
- [ ] PR deploya em prod e tudo continua acessível por rafaelemeth@gmail.com
