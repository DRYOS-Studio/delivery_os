# Tarefas — fluxo de navegação e gestão

**Última revisão**: 2026-08-21 — reconciliado com AD-010 a AD-014 (PRs #97 a #133).
A revisão anterior (2026-05-18, PR #52) descrevia o modelo pré-área: tarefa
como filha obrigatória de Frente, sem responsável múltiplo, sem subtarefa e
sem view cross-Frente. Nada disso vale mais.

Esta nota descreve onde as tarefas vivem na UI, como você chega até elas e
quais ações estão disponíveis em cada ponto.

## Os dois tipos de tarefa (XOR)

`tasks` é uma tabela com duas famílias mutuamente exclusivas — invariante 15 do
`CLAUDE.md`, enforced no banco pelo `CHECK check_tasks_area_xor_frente`:

| | Tarefa de **entrega** | Tarefa de **área** |
|---|---|---|
| `frente_id` | obrigatório | `NULL` |
| `area_id` | `NULL` | obrigatório (FK → `areas`, write-once via trigger) |
| `operation_id` | sempre presente (backfill da Frente) | sempre presente |
| Vive em | detalhe da Frente | aba "Área / Interno" da Operação |
| Quem vê | quem lê a Operação (membro real **ou** área com concessão) | admin + quem é da área **com concessão** daquela operação |
| Aparece no `/public` | sim, como "próximos movimentos" | **nunca** |

`operation_id` é `NOT NULL` nas duas — tarefa órfã de Operação não existe.
Tarefa órfã de *Frente* existe e é normal: é a tarefa de área.

## Tarefa de entrega

### Onde vive

```
/operations/[id]/frentes/[fid]        ← lista completa (TasksSection)
/tasks                                ← view cross-Frente (TasksList)
```

O caminho padrão pela Operação: `/operations` → clique na Operação → section
**Frentes** → clique no nome da Frente (oak) ou em **Abrir →**.

Cada linha de Frente exibe uma Pill com contagem de tarefas não-concluídas de
top-level (subtarefa não conta) — `sage` quando há alguma, `neutral` quando é 0.

> **Editar Frente** não fica na linha. A ação vive dentro do detail page, no
> `FrenteMetaCard` ("Editar Frente →"). Clicar abre; editar é ação interna.

### Ações na `TasksSection`

- **Filtrar** por status via tabs (`Abertas`, `Concluídas`, `Todas`) no search
  param `?filter=open|done|all`. Padrão `open`.
- **Criar** em `/operations/[id]/frentes/[fid]/tasks/new`.
- **Criar subtarefa** pelo atalho "+ subtarefa" na linha, que abre o form de
  criação com `?parent=<taskId>`.
- **Editar** clicando no título → `.../tasks/[tid]/edit`.
- **Ciclar status** pelo botão à esquerda do título: `todo` → `doing` → `done`
  → `todo`. O status `blocked` só entra pelo form de edição; o botão de ciclo
  o ignora.
- **Excluir** pelo ícone de lixeira. Só admin vê o botão
  (`TaskListItem.tsx:158`), e `deleteTaskAction` abre com `requireAdminAction()`
  — defense-in-depth, não só UI.

### View cross-Frente `/tasks`

Item de nav "Tasks" com badge das minhas tarefas abertas. Agrega tarefas de
todas as Frentes e Operações visíveis, com dropdown de responsável:

- **sem param** → minhas tarefas, resolvidas por `profiles.person_id`
  (AD-010). Se o vínculo for `NULL`, cai pra "Todos" — sem empty-state cego.
- **`?assignee=<personId>`** → só daquela pessoa (está *entre* os responsáveis).
- **`?assignee=all`** → tudo que a RLS deixa ver.

Combina com `?filter=open|done|all`. Criar direto daqui em `/tasks/new`
(`TaskQuickCreateForm`, cascade Operação → Frente; Quick Win e incidente SLA
ficam fora — dependem da Operação e moram no form por Frente).

⚠️ `listTasks` não filtra `area_id` nem `parent_task_id` e **não tem `.limit()`**
— `/tasks` mistura entrega, área e subtarefa, e a tab "Todas" degrada primeiro
(achado #21 da auditoria, aberto).

## Tarefa de área

Back-office que não é de conhecimento total da Operação (CS, financeiro,
jurídico). Vive na aba **"Área / Interno"** de `/operations/[id]`:

```
/operations/[id]/areas/new            ← criar
/operations/[id]/areas/[tid]/edit     ← editar
```

A aba só aparece pra quem tem acesso de área — existe tarefa de área visível
**ou** o usuário pode criar uma (`showAreaTab = areaTasksCount > 0 ||
canCreateAreaTask`, `page.tsx:247`). Quem não é da área nem sabe que a aba
existe.

Escopo **não é global** (AD-014 sucede AD-013): a área só alcança as operações
concedidas via `area_clients` / `area_operations`. Membro de área cria e edita
as próprias tarefas de área (`is_area_granted`); **apagar é admin-only**.
Área arquivada não alcança operação nenhuma.

## Subtarefas

Hierarquia pai → filha de **um nível só** (AD-012):

- `tasks.parent_task_id` self-FK `ON DELETE CASCADE`.
- Trigger `enforce_task_parent` barra 2 níveis, exige **mesma Frente** e impede
  que um pai-com-filhas vire filha.
- `CHECK check_tasks_not_self_parent` barra self-parent.
- **Sem rollup de status** — pai e filhas são independentes. A UI só mostra
  "m/n subtarefas".
- Deletar o pai apaga as filhas (CASCADE, perda controlada e deliberada).
- Só tarefa de entrega tem subtarefa (o trigger exige Frente).

Se um dia precisar de dependência real ("A bloqueia B"), é feature nova — não
estender este modelo.

## Responsáveis

N:N via junção `task_assignees(task_id, person_id)`, **todos iguais** — não
existe "responsável principal" (AD-011). A coluna `assignee_person_id` foi
dropada; a junção é fonte única. Só pessoa interna pode ser responsável (RLS).

Nos forms é checkbox múltiplo; na lista por Frente vira grupo de avatares; em
`/tasks` os nomes vêm concatenados.

## Datas e conclusão

- `start_date` e `due_date` são ambos nullable, com
  `CHECK check_tasks_start_before_due` (`start_date <= due_date` quando os dois
  estão preenchidos).
- Status `done` → `completed_at = now()` pelo trigger
  `manage_task_completed_at`. Voltar pra `todo`/`doing`/`blocked` limpa o campo
  (mesmo trigger).
- Título concluído recebe `line-through` na lista.

## Contagens — atenção, as duas não batem

| Superfície | O que conta | Origem |
|---|---|---|
| Pill na linha da Frente (`/operations/[id]`) | só top-level (`parent_task_id` null), não-`done` | `queries/operations.ts:305` |
| Header do detalhe da Frente | só top-level (`parentTaskId` null) | `frentes/[fid]/page.tsx:48` |
| Badge do nav "Tasks" | minhas abertas | `countMyOpenTasks` |
| Card "Tarefas abertas" (`/admin/dashboard`) | abertas nas Frentes não-arquivadas, admin-only | `countAllOpenTasks` |

As duas primeiras usam a mesma regra: **subtarefa não conta**. Até a issue
#136 divergiam — a lista somava subtarefa e o header não, então a mesma Frente
mostrava "5 tarefas" numa tela e "3 abertas" na outra.

As duas últimas contam por allowlist (`OPEN_STATUSES`) em vez de `!== "done"`.
Hoje é equivalente, porque `task_status` é exatamente
`todo | doing | blocked | done` — se um status novo entrar, as duas formas
divergem.

## Onde a tarefa aparece — e onde não

- **`/public/[token]`** — tarefa de **entrega** aparece na seção "Próximos
  movimentos" do relatório do cliente. `fetchUpcomingTasks` filtra
  `.is("area_id", null)` (`public-report.ts:91`) e escopa a operação
  server-side antes do `limit(20)`. Tarefa de área **nunca** vaza.
- **`/clients/[id]`** — não exibe tarefas.
- **Home (`/`)** — sem widget de tarefas.
- **`/operations/[id]`** — só o agregado na Pill da Frente, mais a aba
  "Área / Interno" pra quem tem acesso de área.

## Permissões, resumido

| Ação | Quem |
|---|---|
| Ler tarefa de entrega | quem lê a Operação (`can_read_operation`) |
| Criar/editar tarefa de entrega | quem escreve na Operação (`can_see_operation`) |
| Ler tarefa de área | admin + área com concessão da operação |
| Criar/editar tarefa de área | admin + membro da área concedida (`is_area_granted`) |
| Excluir qualquer tarefa | **admin only** (`requireAdminAction`) |

## Referências

- Schema: [DATABASE_SCHEMA.md](../DATABASE_SCHEMA.md) (seção `tasks`, `task_assignees`)
- Invariante 15: `CLAUDE.md`
- Decisões: AD-010 (vínculo user→pessoa), AD-011 (multi-responsável),
  AD-012 (subtarefa), AD-013 e AD-014 (tarefa de área) em `.specs/project/STATE.md`
- Specs: `.specs/features/tasks/`, `.specs/features/areas-as-access-groups/`
