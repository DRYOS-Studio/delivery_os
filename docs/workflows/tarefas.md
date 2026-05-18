# Tarefas — fluxo de navegação e gestão

**Última revisão**: 2026-05-18 (PR #52)

Tarefas (`tasks`) são planejadas por Frente. Esta nota descreve onde
elas vivem na UI, como você chega até elas e quais ações estão
disponíveis em cada ponto.

## Onde a tarefa vive

Tarefa é filha de Frente (FK `frente_id` NOT NULL, CASCADE). Não existe
tarefa órfã.

A página de detalhe da Frente é o único lugar com lista de tarefas:

```
/operations/[id]/frentes/[fid]
```

Esta página renderiza:

1. `FrenteMetaCard` — meta da Frente (tipo, domínio, fase, status
   acionável, responsável) e link "Editar Frente →".
2. `TasksSection` — lista de tarefas com filtros e botão de criar.

## Como chegar até a tarefa

A entrada padrão começa na Operação:

1. Abra a lista em `/operations` e clique numa Operação.
2. Em `/operations/[id]`, role até a section **Frentes**.
3. Na linha da Frente, clique em uma das duas opções:
   - **Nome da Frente** (em oak, link sutil mas afforded por cor).
   - **Abrir →** no fim da linha (link explícito).

Cada linha exibe, ao lado do nome, uma Pill com a contagem de tarefas
abertas (status `todo`, `doing` ou `blocked`):

- Pill `sage` quando há tarefa aberta.
- Pill `neutral` quando o contador é 0.

> **Editar Frente** sai da linha. A ação fica dentro do detail page,
> via "Editar Frente →" no `FrenteMetaCard`. Esse rearranjo casa com
> o padrão do resto do app: clicar abre, editar é uma ação interna.

## Ações dentro da Frente

Na `TasksSection` você pode:

- Filtrar a lista por status via tabs (`Abertas`, `Concluídas`,
  `Todas`). O filtro vai no search param `?filter=open|done|all`. O
  padrão é `open`.
- Criar uma nova tarefa pelo botão **+ Nova tarefa**, que leva a
  `/operations/[id]/frentes/[fid]/tasks/new`.
- Editar uma tarefa existente clicando no título da linha, que leva a
  `/operations/[id]/frentes/[fid]/tasks/[tid]/edit`.
- Mudar status em ciclo pelo botão à esquerda do título: `todo` →
  `doing` → `done` → `todo`. O status `blocked` muda apenas pelo form
  de edit; o botão de ciclo o ignora.
- Excluir uma tarefa pelo ícone de lixeira na linha. **Apenas admin**
  vê este botão (Inv. 14 do `CLAUDE.md`; defense-in-depth também na
  action `deleteTaskAction`).

## Tarefa concluída

Quando o status vira `done`:

- O título recebe `line-through` na lista.
- A coluna `completed_at` recebe `now()` automaticamente. Um trigger
  (`manage_task_completed_at`) cuida disso no banco.
- Voltar a tarefa para `todo`, `doing` ou `blocked` limpa o
  `completed_at` (mesmo trigger).

A Pill de count na linha da Frente ignora tarefas `done` — você só vê
o que ainda está em jogo.

## Onde a tarefa NÃO aparece

- **Sidebar** — não há item global `/tasks` no MVP. Uma view
  cross-Frente ("Minha agenda") fica para uma feature futura.
- **`/operations/[id]`** — apenas o agregado na Pill da Frente. A
  lista completa exige abrir a Frente.
- **`/clients/[id]`** — não exibe tarefas.
- **`/public/[token]`** — tarefas são internas. A página pública
  continua mostrando apenas status acionável, decisões com
  `visibility=cliente`, Quick Wins e incidentes resolvidos.
- **Home (`/`)** — sem widget de tarefas no MVP.

## Visão agregada (admin only)

O painel admin (`/admin/dashboard`) traz um card **"Tarefas abertas"**
no grid de status. Conta tarefas com status `todo`, `doing` ou
`blocked` em todas as Frentes não-arquivadas. Esse card é visível
apenas para admin (já gateado por `requireAdmin()` na rota).

## Mudanças recentes

- **PR #52** — Link no nome da Frente vira `text-oak` (afforded).
  "Editar →" no fim da linha vira "Abrir →" apontando para o detail.
  Pill com count de tarefas abertas passa a aparecer ao lado do nome.
- **PR #48** — Feature original `tasks`: tabela, trigger
  `manage_task_completed_at`, RLS, página de detalhe da Frente,
  formulários, card no painel admin.

## Referências

- Schema da tabela: [DATABASE_SCHEMA.md](../DATABASE_SCHEMA.md) (seção `tasks`)
- Spec da feature: `.specs/features/tasks/`
- Spec do fix de navegação: PR #52 / issue #51
