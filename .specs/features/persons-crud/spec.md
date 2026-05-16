# persons-crud Specification

## Problem Statement

Persons (internas + externas) só existem via seed. Sem CRUD pela UI:
- Rafael+Gabi não podem ser editados; novos devs não entram
- Pessoas externas dos Clientes não podem ser cadastradas (detalhe do Cliente mostra "Nenhuma pessoa externa")
- FrenteForm tem campo "Responsável" mas universo limitado ao seed
- AllocationsCRUD futura vai falhar sem pool de pessoas reais

Esta feature entrega CRUD completo + traz o **Avatar component** (skill `dryos-design-system` já especifica) que se espalha por toda UI: Sidebar footer, FrentesListSection (mostrar responsável real), ExternalPersonsList no detalhe do Cliente, e as listas/detalhes dessa feature.

## Goals

- [ ] Usuário cria/edita/arquiva Pessoa interna ou externa em `/persons`
- [ ] Lista `/persons` com tabs **Internas / Externas / Todas** + busca + pill de contagem
- [ ] Detalhe `/persons/[id]` mostra alocações da pessoa: internas listam Frentes+Operação+role+capacity; externas listam Operações do Cliente vinculado
- [ ] Avatar component canônico em `src/components/ui/Avatar.tsx` reusado em 4 lugares
- [ ] FrenteForm select "Responsável" continua funcionando com o pool ampliado

## Out of Scope

- **Pessoa interna logada do Supabase Auth** — `auth.users` é separado de `persons`. Quando precisar vincular (ex: "Editar como minha pessoa"), feature dedicada com tabela `profiles`. Sem `profiles` ainda.
- **Upload de foto** — Avatar usa iniciais; foto vira v2 com Storage
- **Bulk import** (CSV upload de pessoas externas dum Cliente) — útil mas defere
- **Mudança de `kind`** (internal → external ou vice-versa) — bloqueada no edit; pra mudar = arquivar + criar nova
- **Restore de arquivada** — soft-delete via `archived_at` apenas
- **Histórico de alocações arquivadas** — só lista as ativas no detalhe
- **Convidar pessoa interna pra Supabase Auth** — fluxo separado
- **State machine de role externo** — campo `external_role` é texto livre por enquanto

---

## User Stories

### P1: Avatar component canônico ⭐ MVP

**User Story**: Como dev, quero `<Avatar initials="RA" />` que renderiza círculo oak com iniciais em Funnel Display.

**Why P1**: Bloqueia visual de toda a feature + atualiza UI existente (sidebar, frentes, external persons).

**Acceptance Criteria**:

1. `src/components/ui/Avatar.tsx` exporta:
   ```ts
   type AvatarProps = {
     initials: string;
     size?: 'sm' | 'md' | 'lg' | 'xl';
     color?: 'oak' | 'sage-deep' | 'oak-light';
     className?: string;
   };
   ```
2. Tamanhos per skill: `sm w-6 h-6 text-[10px]`, `md w-8 h-8 text-xs`, `lg w-12 h-12 text-base`, `xl w-16 h-16 text-xl`
3. Variantes de cor por `bg-{color}`; texto `text-bg` por contraste
4. Helper `src/lib/utils/initials.ts` exporta `getInitials(name: string): string` — primeira letra da primeira palavra + primeira letra da última palavra (se ≥2 palavras), uppercase. Ex: "Rafael" → "R"; "Ana Lisboa" → "AL"; "  Maria   Silva Santos  " → "MS"
5. Sidebar footer: substitui texto-only por `<Avatar initials="R" size="sm" color="oak" />` + email truncado + ícone logout
6. ExternalPersonsList: cada linha começa com `<Avatar initials size="sm" />`
7. FrentesListSection: se responsável existe, mostra avatar pequeno antes do status acionável

**Independent Test**: Inspecionar render de Sidebar autenticado → ver "R" oak circle no footer. Visitar detalhe de Cliente com persons externas → ver iniciais nas linhas.

---

### P1: Lista /persons com tabs Internas/Externas/Todas + busca ⭐ MVP

**User Story**: Como admin, quero ver todas as pessoas em uma tabela filtrável por kind, pra escanear time interno vs externo dos clientes.

**Why P1**: Coração da feature.

**Acceptance Criteria**:

1. WHEN `/persons` é visitada autenticada THEN SHALL renderizar:
   - PageHeader `title="Pessoas"` `subtitle="{N} pessoas ativas"` `actions={<Link href="/persons/new"><Button variant="sage">+ Nova pessoa</Button></Link>}`
   - Tabs row: **Internas (N)**, **Externas (M)**, **Todas (N+M)** — TODAS clicáveis (estado controlado via `?kind=internal|external|all`, default `all`)
   - Search input (mesmo pattern de /clients) — server-side via `?q=`
   - Tabela com colunas:
     - **Avatar** (sm)
     - **Nome** (text-ink)
     - **Tipo** (Pill: "Interna" oak / "Externa" sage)
     - **Especialidade / Papel externo** (mono text-mute)
     - **E-mail** (mono; mailto se houver, "—" senão)
     - **Cliente** (só pra externas — pra internas mostra "—")
     - **Ações** (Abrir →)
2. Empty state varia: sem filtro = "Nenhuma pessoa cadastrada." + CTA; com busca/filtro = "Nenhuma pessoa para {filtro/busca}."
3. Tabs atualizam via `router.push` mantendo `q` quando existe; URL é `/persons?kind=internal&q=raf`
4. Sidebar ganha **"Pessoas"** com ícone `User2` (ou similar) + pill de contagem em `Espaço de trabalho`

---

### P1: Criar Pessoa (interna ou externa) ⭐ MVP

**User Story**: Como admin, quero clicar "Nova pessoa", escolher tipo (interna/externa) e ver os campos adequados aparecerem.

**Why P1**: Bloqueia tudo se faltar.

**Acceptance Criteria**:

1. WHEN `/persons/new` é visitada THEN SHALL renderizar form com:
   - **Tipo** (segmented control / radio: "Interna" | "Externa"; required; default "Interna")
   - **Nome** (text, required)
   - **E-mail** (email, opcional)
   - Quando `kind=internal`:
     - **Especialidade** (text, required, ex: "Engenharia", "Marketing")
   - Quando `kind=external`:
     - **Papel** (text, required, ex: "Diretor de Operações")
     - **Cliente** (select, required; options = listClients ativos)
2. Submit via `createPersonAction(formData)` que valida via Zod discriminated union; map errors 23514 (CHECK chk_persons_kind_consistency) → "Configuração inválida pra tipo selecionado."
3. Sucesso → `router.push('/persons/{id}')` (detalhe)
4. Empty state se 0 clientes (e kind=external escolhido) → "Crie um Cliente primeiro" + link

---

### P1: Detalhe da Pessoa com alocações ⭐ MVP

**User Story**: Como admin, quero abrir uma Pessoa e ver onde ela atua: Frentes (se interna) ou Operações do Cliente (se externa).

**Why P1**: Sem isso, lista vira dead-end.

**Acceptance Criteria**:

1. WHEN `/persons/[id]` é visitada THEN SHALL renderizar:
   - Header: Avatar (lg) + nome em display 2.5rem + Pill kind + linha mono com especialidade ou papel
   - PageHeader actions: `<Button variant="ghost">Editar</Button>` link pra `/persons/[id]/edit`
   - Se `email`: bloco mailto pequeno
   - **Se kind=internal**: Section "Alocações" — lista por Frente (nome + Pill ciclo + role + capacity%); empty state "Sem alocações ativas." Agrupado por Operação (header da Op + lista de Frentes embaixo).
   - **Se kind=external**: Section "Cliente" mostra o cliente vinculado (nome + slug + link `/clients/[id]`). Abaixo: "Operações do Cliente" — lista de Operações que pertencem ao cliente (reuso de OperationCard talvez em grid compacto).
2. WHEN id inválido ou arquivada THEN `notFound()`

**Independent Test**: Visitar detalhe de Rafael (seed) → ver Avatar "R" + nome + "Engenharia" + 2 Alocações (Acme Core/Infra como executor 40%; Beta Spark Inbox/Infra como executor 30%). Visitar pessoa externa (criar uma manualmente) vinculada a Acme → ver "Cliente: Acme" + lista das Operações da Acme.

---

### P1: Editar + arquivar Pessoa ⭐ MVP

**User Story**: Mesmo padrão de clients/operations.

**Acceptance Criteria**:

1. `/persons/[id]/edit` pré-preenche form. `kind` **disabled** (não pode mudar — pra mudar = nova pessoa)
2. `updatePersonAction`: valida; UPDATE; mapping de erros
3. `archivePersonAction(id)`:
   - **Guard interna**: se há `allocations` ativas, bloquear com `has_active_allocations`
   - **Guard externa**: se a pessoa é responsável de Frente, FK é SET NULL — não bloqueia, mas avisa? Por agora, deixa archive seguir (FK absorbe)
   - Senão archive
4. Botão Arquivar (ghost critical) com `window.confirm`

---

### P1: Usar Avatar nos lugares existentes ⭐ MVP

**Acceptance Criteria**:

1. Sidebar footer: `<Avatar initials={initialsFromEmail} />` + email truncado + LogOut button. Initials derivadas: pega prefixo do email, splitta por `.`/`-`, primeira letra de cada bloco até 2. "rafaelemeth@gmail.com" → "R" (sem ponto); "joao.silva@..." → "JS"
2. ExternalPersonsList: prepende `<Avatar initials={getInitials(name)} size="sm" />` em cada linha
3. FrentesListSection: se `responsiblePersonId`, renderiza avatar pequeno antes do status acionável. (Requer query atualizada: trazer `responsible_person:persons(name)` no embed do `getOperation`.)

---

### P2: Sugestão automática de nome

Persons não tem sugestão óbvia. Skip.

### P2: Detalhe da pessoa externa mostra avatares de outras externas do mesmo Cliente

Polish; útil mas não bloqueia.

### P3: Convidar pessoa interna pro Supabase Auth direto do detalhe

Out of scope MVP.

---

## Edge Cases

- WHEN user troca `kind` no form de criar (radio switch) THEN campos do kind anterior são limpos via `setValue` (defesa contra state stale + Zod refine que enforça)
- WHEN cliente do select é arquivado entre fetch e submit THEN action retorna `invalid_fk`
- WHEN external sem client (state stale) THEN Zod refine rejeita
- WHEN internal com client_id ou external_role preenchidos (state stale) THEN Zod rejeita
- WHEN tenta arquivar interna com allocations ativas THEN "Pessoa tem N alocações ativas. Remova antes."

---

## Success Criteria

- [ ] `npm run typecheck` + `build` verdes
- [ ] `/persons` mostra 2 internas (Rafael+Gabi) + 0 externas com tabs funcionando
- [ ] Criar pessoa externa "Maria — Diretora @ Acme" → aparece com tipo Externa
- [ ] Detalhe Rafael mostra 2 alocações agrupadas por Op
- [ ] Detalhe Maria mostra Acme + Operações de Acme
- [ ] Sidebar footer mostra Avatar real
- [ ] FrenteForm Responsável continua funcionando (select agora pode ter Rafael+Gabi+novos)
- [ ] Detalhe Acme: ExternalPersonsList mostra Maria com avatar
- [ ] Arquivar Rafael (tem allocations) → bloqueia
- [ ] Editar Rafael → kind disabled
