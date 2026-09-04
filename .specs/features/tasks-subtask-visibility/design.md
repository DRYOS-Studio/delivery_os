# Visibilidade de subtarefas — Design

Stack: Next.js App Router (server components + Server Actions), Supabase
client direto (sem ORM). Trilha: Frontend + Backend leve (query only, sem
migration, sem RLS novo).

> Rodada 3 (pós design-gate PASS + fool-gate modo design, 2 rodadas FAIL).
> Histórico: rodada 1 — 1 BLOCKER design-gate (`.eq("assignees.person_id",
> P)` remanescente) + 3 BLOCKER fool-gate (guard de lista vazia só em prosa;
> `countTasks` "byte a byte" apagaria o banner de truncamento; teste de "sem
> responsável" sujeito a RLS de `persons`). Rodada 2 — design-gate PASS;
> fool-gate 1 BLOCKER novo (`countSelect` do count sem o embed `!inner` de
> `operation.archived_at`, filtro descartado em silêncio). Rodada 3 — 1
> BLOCKER: o fix da rodada 2 pra "sem responsável" ainda embedava `persons`
> dentro da linha "crua" (só adiava o problema, não eliminava), e dependia
> de uma semântica do PostgREST (poda vs `person: null`) não verificada.
> **Fix final (D1.3):** a checagem de herança usa um embed dedicado
> `assigneeLinks:task_assignees(person_id)` que NUNCA atravessa `persons` —
> elimina a pergunta em vez de responder ela.

## AC → onde mora a prova

| AC | Onde a prova mora |
|---|---|
| Story1 AC1 (herda sem responsável) | `resolveAssignedTaskIds` + `.or(id.in, parent_task_id.in)` em `listTasks`/`countTasks`, `tasks.ts` |
| Story1 AC2 (não herda com responsável próprio Q≠P) | `filterInheritedRows` sobre o embed dedicado `assigneeLinks:task_assignees(person_id)` — nunca atravessa `persons`, imune à RLS que poderia zerar o array de exibição (ver D1.3) |
| Story1 AC3 (não herda de pai alheio) | `resolveAssignedTaskIds` só retorna ids de P; `.or()` não inclui filhas de outro pai |
| Story1 AC4 (Todos sem herança) | `assigneePersonId` undefined → `resolveAssignedTaskIds`/`.or()` nunca chamados (branch existente preservado) |
| Story1 AC5 (herança independe do status do pai) | `resolveAssignedTaskIds` SEM `.in("status", ...)` — query só em `task_assignees`, não em `tasks` |
| Story1 AC6 (count = list, até o teto) | `countTasks` reusa a MESMA `resolveAssignedTaskIds` + mesmo `.or()` + mesmo alias `assigneeLinks` + mesmo `filterInheritedRows` de `listTasks` (nenhum dos dois shapes diverge); `listTasks` aplica `.limit(TASKS_PAGE_LIMIT)`, `countTasks` **não aplica limit** (ver D2) |
| Story2 AC1 (mostra subtarefas no pai) | `listSubtasksOf(tid)` nova query + `TaskListItem` reaproveitado em `edit/page.tsx` |
| Story2 AC2 (omite bloco vazio) | `subtasks.length > 0 &&` no JSX de `edit/page.tsx` |
| Story2 AC3 (link de navegação) | Vem de graça do `TaskListItem` reaproveitado (não reimplementado) |
| Edge case — P sem nenhuma task atribuída | `resolveAssignedTaskIds` retorna `[]` → `listTasks`/`countTasks` retornam vazio **sem** chamar `.or()` (guard explícito, D1.2) |
| Edge case — Operação arquivada não vaza por herança | `.is("operation.archived_at", null)` com `operations!inner` continua na query principal, aplicado a TODA linha retornada (herdada ou direta) — não é tocado por D1 |
| Edge case — pai/filha frentes diferentes / área | Invariante do trigger `enforce_task_parent` + XOR `area_id`/`frente_id` — nada no código desta feature depende de contornar isso |
| Edge case — subtarefa com responsável próprio que também é P (sem duplicar linha) | Query única com `.or()` (uma linha física por task, não duas mescladas): `assignedIds.has(r.id)` já é `true` pelo match direto, então a linha entra pelo primeiro termo do `||` em `filterInheritedRows` — a cláusula de herança nem precisa avaliar |

## Decisões

### D1 — Herança via lookup + `.or()` numa única query + filtro pós-fetch sobre a linha CRUA

**D1.1 — Lookup sem status, reusado 1x por request.**

```ts
async function resolveAssignedTaskIds(
  supabase: Awaited<ReturnType<typeof createServer>>,
  personId: string,
): Promise<string[]> {
  const { data, error } = await supabase
    .from("task_assignees")
    .select("task_id")
    .eq("person_id", personId);
  if (error) throw new Error(`resolveAssignedTaskIds: ${error.message}`);
  return (data ?? []).map((r) => r.task_id);
}
```

Sem filtro de status (prova de AC5). Chamada **uma vez dentro de
`listTasks`** e **uma vez dentro de `countTasks`** — 2 lookups por request de
`/tasks` (que dispara as duas em paralelo, `tasks/page.tsx:43-47`), nunca 3×
como seria se cada uma das antigas 3 sub-queries de `countTasks` resolvesse
os ids sozinha (é o que D2 elimina ao trocar `Promise.all` de 3 queries por
1 query + partição em JS). Os dois lookups são snapshots independentes da
mesma tabela no mesmo request — divergência exigiria escrita concorrente
`task_assignees` entre as duas chamadas, mesma janela de corrida que já
existe hoje entre `listTasks`/`countTasks` sem relação com esta feature;
não é um risco novo.

**D1.2 — Guard de lista vazia, no código, não só em prosa.**

```ts
if (assigneePersonId) {
  const assignedIds = await resolveAssignedTaskIds(supabase, assigneePersonId);
  if (assignedIds.length === 0) return []; // listTasks
  // countTasks: return { open: 0, done: 0, all: 0 }
  query = query.or(`id.in.(${assignedIds.join(",")}),parent_task_id.in.(${assignedIds.join(",")})`);
}
```

Sem isso, `.or("id.in.(),parent_task_id.in.()")` é sintaxe inválida no
PostgREST — usuário recém-vinculado (`person_id` setado, zero
`task_assignees`) levaria 500 em `/tasks` no default. É o caminho MAIS
comum de bater nesse guard (default da página é "eu"), não um edge case raro.

**D1.3 — `filterInheritedRows` NUNCA atravessa `persons` — embed dedicado
só com `person_id`, desacoplado do embed de exibição.**

Motivo (achado do fool-gate, rodadas 1-3 do design): `mapAssignees`
(`tasks.ts:76-81`) descarta entradas cujo `person` embedado veio `null` —
`persons_scoped_select` (RLS) só libera pessoa interna com allocation numa
operação legível pro usuário atual. Se o teste de "subtarefa órfã" rodasse
sobre QUALQUER array que passou por um embed até `persons`, um Membro
(não-admin) olhando uma subtarefa delegada a alguém sem allocation visível
pra ele veria esse array vazio **mesmo a subtarefa tendo responsável** —
vazando a linha por herança (quebra AC2 só pra Membro, não pra Admin).

A rodada 2 corrigiu isso rodando o filtro sobre a linha crua de
`task_assignees` **antes** do mapeamento de exibição — mas a rodada 3 do
fool-gate mostrou que isso não fecha por si só: mesmo a linha "crua" do
select ainda é `task_assignees ( person:persons!...(id,name) )`, ou seja
ainda EMBEDA `persons` dentro de cada elemento; se o PostgREST, ao invés de
devolver `person: null`, **podar o elemento inteiro** do array quando o
nested to-one falha RLS (comportamento que eu não verifiquei ao vivo — leitura,
não execução), o array chega vazio de qualquer forma e a herança dispara
igual, porque o teste continua dependendo de uma leitura de `persons` que
pode não acontecer.

**Fix definitivo: não depender de resposta alguma sobre `persons`.** O
select ganha DOIS embeds pra `task_assignees`, sob aliases diferentes —
um pra exibição (como hoje, atravessa `persons`) e um pra herança (só a
FK, nunca atravessa `persons`):

```
assignees:task_assignees ( person:persons!fk_task_assignees_person_id (id, name) ),
assigneeLinks:task_assignees ( person_id )
```

`assigneeLinks` não embeda `persons` — `person_id` é coluna própria de
`task_assignees`. O array `assigneeLinks` é regido **só** pela RLS de
`task_assignees` (`can_see_task`, igual a `tasks`) e nunca invoca
`persons_scoped_select`, então a questão "poda vs `person: null`" deixa de
importar: não há segundo nível de RLS pra podar ou não podar. `assignees`
(o embed de exibição, com nomes) continua existindo só pra UI, sem
participar da decisão de herança.

**Fail-closed, não fail-open** (achado do fool-gate rodada 4): o teste de
"órfã" exige a chave presente e um array de fato — se `assigneeLinks` vier
`undefined`/faltando (select errado, alias renomeado, engano de merge), a
subtarefa é tratada como **tendo** responsável (exclui da herança) em vez
de órfã (que vazaria). `?? 0 === 0` da v1 deste doc era fail-open (chave
ausente virava "0 assignees" → herda); `Array.isArray` explícito falha
fechado:

```ts
function filterInheritedRows<
  T extends { id: string; parent_task_id: string | null; assigneeLinks: { person_id: string }[] | null | undefined },
>(rows: T[], assignedIds: Set<string>): T[] {
  return rows.filter(
    (r) =>
      assignedIds.has(r.id) ||
      (r.parent_task_id !== null &&
        assignedIds.has(r.parent_task_id) &&
        Array.isArray(r.assigneeLinks) &&
        r.assigneeLinks.length === 0),
  );
}
```

Aplicado **antes** de `mapRow`/`mapCrossFrenteRow`, sobre `TaskJoinedRow[]`/
`CrossFrenteJoinedRow[]` — só que **nem todo** tipo raw do módulo ganha esse
campo: só o select de `listTasks` (`CrossFrenteJoinedRow`) e o de
`countTasks` (`CountJoinedRow`, D2) declaram `assigneeLinks`. `TaskJoinedRow`
(usado por `listTasksByFrente`, `listAreaTasksByOperation`, `getTask` — todos
via `TASK_SELECT`, que não pede esse embed) **não** ganha o campo — declarar
ali seria tipo mentiroso atrás do `as unknown as` que essas três queries já
usam. A chave fica **camelCase** (`assigneeLinks`), igual ao alias do
select — PostgREST devolve a chave exatamente como aliasada, não existe
conversão pra snake_case aqui (correção da rodada 3: a frase anterior deste
documento dizia "vira `assignee_links` snake_case", errada). O mapper de
exibição ignora `assigneeLinks` (só usa `assignees` pra montar
`TaskRow.assignees`). `countTasks` (D2) usa o MESMO alias
`assigneeLinks: task_assignees(person_id)` — não um select diferente —
fechando o W1 da rodada 2 (assimetria de shape entre os dois call-sites).

**Sem precedente no repo pra dois aliases da mesma relação num select**
(`assignees:task_assignees(...)` + `assigneeLinks:task_assignees(...)`,
ambos apontando pra `task_assignees`) — varredura em `src/lib/db/queries/`
não achou um select existente que aliase a mesma tabela 2× (achado da
rodada 4). É sintaxe padrão do PostgREST (cada alias é um embed
independente, é a razão de aliases existirem), mas é **leitura, não
execução**. **Ação na Fase 4:** ao validar a Fase 4, inspecionar o payload
real de um request de `/tasks` filtrado e confirmar que `assigneeLinks`
aparece como array (mesmo vazio) numa subtarefa COM responsável — não só
que a linha certa aparece/some, mas que a CHAVE existe no JSON. Se vier
ausente, o guard fail-closed acima já protege (exclui em vez de vazar), mas
o comportamento correto (subtarefa aparecer quando deveria) ficaria quebrado
silenciosamente — vale testar os dois lados.

**D1.4 — Remove o `.eq("assignees.person_id", ...)` remanescente (o
BLOCKER do design-gate rodada 1).**

Hoje `listTasks` usa `task_assignees!inner` + `.eq("assignees.person_id", P)`
(`tasks.ts:262,333-334`) — o `!inner` restringe as LINHAS de `tasks`, o `.eq`
restringe o ARRAY `assignees` embedado a só as entradas de P. D1 tira o
`!inner` (a filtragem de linha passa a ser o `.or()`), mas se o `.eq` ficar,
o embed continua chegando restrito a P — uma subtarefa de Q≠P chegaria com
`assignees` contendo só entradas que batem `person_id = P`, ou seja **vazio**,
e cairia no mesmo buraco do D1.3 (pareceria órfã). **Os dois — `!inner` E o
`.eq` sobre `assignees.person_id` — saem juntos.** O embed vira sempre
completo e sem filtro (`task_assignees ( person:persons!... (id, name) )`,
igual ao branch "Todos" de hoje); a filtragem de QUEM aparece é 100% o
`.or()` + `filterInheritedRows`, não mais o embed.

**Por que não RPC/view SQL.** Resolveria D1.2/D1.3/D1.4 em SQL puro
(`NOT EXISTS`, sem lookup separado, sem lista de ids na URL) e o count
voltaria a ser `count:'exact', head:true`. Rejeitado por custo/escopo (correção
da rodada 2 do fool-gate: uma view/função `SECURITY INVOKER` herdaria a RLS
das tabelas base em vez de abrir superfície nova — Inv. 12 fala de tabela,
não se aplica aqui direto): é migration + regen de `types.ts` + revisão pra
um bug de leitura, no volume declarado pelo usuário (~5 tarefas). **Débito
registrado, com gatilho numérico:** ids de P (todo histórico, `done`
incluso — AC5 proíbe filtrar por status) entram 2× na URL do `.or()`
(`id.in` e `parent_task_id.in`), ~37 bytes por aparição (UUID + separador) ×
2 aparições ≈ 74 bytes/tarefa; o limite típico de request-line (~8 KB / 74)
cai perto de **~110 tarefas já atribuídas à mesma pessoa ao longo do
tempo** (produção tem 17 tarefas no total hoje, `STATE.md`) — acima disso o
request falha (400/414) em vez de degradar. Revisitar como RPC/view quando
alguma pessoa se aproximar desse número.

### D2 — `countTasks`: uma query sem `limit`, partição em JS — não 3 reescritas de `.eq`

Pra AC6 bater com `listTasks` **sem** apagar o banner de truncamento
(`TasksList.tsx:44-47`, que depende de `counts[filter] > tasks.length`):
`countTasks` busca as linhas candidatas **uma vez** (filtro de responsável
igual ao D1, **sem** `.limit(TASKS_PAGE_LIMIT)` — só `listTasks` tem teto),
aplica `filterInheritedRows`, e particiona open/done/all em JS via
`isOpenStatus` (já existe, `tasks.ts:24-26`) — não 3 queries `Promise.all`
como hoje.

```ts
const COUNT_SELECT = `
  id, parent_task_id, status,
  assigneeLinks:task_assignees ( person_id ),
  operation:operations!fk_tasks_operation_id!inner ( archived_at )
`;

type CountJoinedRow = {
  id: string;
  parent_task_id: string | null;
  status: TaskStatus;
  assigneeLinks: { person_id: string }[] | null;
};

export async function countTasks(assigneePersonId?: string) {
  const supabase = await createServer();
  let query = supabase.from("tasks").select(COUNT_SELECT);
  query = query.is("operation.archived_at", null);
  let assignedIds: Set<string> | null = null;
  if (assigneePersonId) {
    const ids = await resolveAssignedTaskIds(supabase, assigneePersonId);
    if (ids.length === 0) return { open: 0, done: 0, all: 0 };
    assignedIds = new Set(ids);
    query = query.or(`id.in.(${ids.join(",")}),parent_task_id.in.(${ids.join(",")})`);
  }
  const { data, error } = await query;
  if (error) throw new Error(`countTasks: ${error.message}`);
  const rows = data as unknown as CountJoinedRow[]; // mesmo padrão de tasks.ts:126,185,217,357 — select não-literal não infere shape
  const filtered = assignedIds ? filterInheritedRows(rows, assignedIds) : rows;
  const open = filtered.filter((r) => isOpenStatus(r.status)).length;
  const done = filtered.filter((r) => r.status === "done").length;
  return { open, done, all: filtered.length };
}
```

Mesmo alias `assigneeLinks` do D1.3 — não um select diferente por
call-site (fecha o W1 da rodada 2: a checagem de herança usa exatamente o
mesmo shape em `listTasks` e `countTasks`, então os dois nunca podem
divergir por causa de RLS de `persons`, porque nenhum dos dois a invoca
pra essa checagem). Cast `as unknown as CountJoinedRow[]` segue o padrão já
usado 4× no arquivo pra select não-literal (Supabase JS não infere tipo de
string dinâmica). `COUNT_SELECT` precisa de `id, parent_task_id, status,
assigneeLinks:task_assignees(person_id)` pro pós-processamento **e** de
`operation:operations!fk_tasks_operation_id!inner(archived_at)` — sem o
embed com `!inner`, `.is("operation.archived_at", null)` não filtra nada
(o comentário original em `tasks.ts:326-331` é explícito sobre isso:
"o `!inner` no embed é obrigatório: sem ele o supabase-js descarta este
filtro" — BLOCKER da rodada 2 do fool-gate: a v1 deste documento omitia
esse embed). Sem `person`/`frente` (não usados no pós-processamento) —
ainda mais leve que o select de `listTasks`.

Resultado: **1 lookup + 1 fetch** por chamada de `countTasks` (era 1 lookup
× 3 na v1 deste doc, que resolvia `assignedIds` dentro de cada uma das 3
queries do `Promise.all` antigo — ver correção de topologia abaixo), os 3
badges nascem internamente consistentes por construção (mesma linha crua
conta pra `all` e cai em exatamente um de `open`/`done`), e o banner de
truncamento continua válido no caso comum: `listTasks` capado em 200,
`countTasks` sem teto — `truncated = counts[filter] > tasks.length` volta a
ser uma comparação real entre "total elegível" e "o que a página mostra".

**Imprecisão aceita, registrada (não corrigida nesta feature):**
`filterInheritedRows` em `listTasks` roda DEPOIS do `.limit(TASKS_PAGE_LIMIT)`
— então a página pode devolver menos de 200 linhas mesmo havendo mais
elegíveis, e o banner (`TasksList.tsx:77`, `"Mostrando {TASKS_PAGE_LIMIT} de
{total}"`) imprime o teto fixo, não o tamanho real da fatia. Preexistente ao
espírito do teto (o corte já não era 100% exato hoje por causa doutros
filtros pós-fetch), piora marginalmente aqui. Aceito pelo volume declarado
(~5 tarefas) — não é o defeito que esta feature existe pra resolver.

Efeito colateral aceito: `countTasks` deixa de usar `count:'exact',head:true`
(mais leve) e passa a trazer linhas de verdade. Aceitável no volume do
produto; troca simplicidade (uma implementação, não duas) por um fetch a
mais que HEAD-only.

**Dependência não verificada, registrada:** `countTasks` sem `.limit()`
presume que o PostgREST do projeto não tem `db-max-rows` configurado abaixo
do volume real de tarefas — se tiver, o fetch sem teto sub-reportaria `all`
em silêncio, o mesmo defeito que D2 existe pra evitar, por outra porta.
Leitura, não execução: não verifiquei a config deste projeto. Invisível no
volume atual (17 tarefas); checar `get_advisors`/config do projeto se o
volume crescer muito antes de confiar cegamente no "sem limit = sem teto".

### D3 — Reaproveitar `TaskListItem` na tela de edição, sem componente novo

`TaskListItem` já faz tudo que a Story2 pede (indent, `CornerDownRight`,
`StatusCycleButton`, `DeleteTaskButton` se admin) — é o mesmo componente
usado em `TasksSection` na tela da Frente. Diferença real do contexto novo
(não é só "cópia de graça", como a rodada 1 descreveu): aqui ele fica ao
lado de um `TaskForm` com estado local não salvo (React Hook Form). Isso é
aceito conscientemente — `StatusCycleButton`/`DeleteTaskButton` chamam
`router.refresh()` (confirmado: `edit/page.tsx` é dinâmico, sem full route
cache, então o RSC pai — incluindo `listSubtasksOf` — reexecuta de verdade,
sem dado stale), o RHF do form da task-pai não é afetado porque vive num
client component separado que não remonta.

`edit/page.tsx` busca `listSubtasksOf(tid)` (nova query, mesmo padrão de
`listTasksByFrente` mas filtrando por `parent_task_id = tid`) só quando
`task.parentTaskId === null` (subtarefa não pode ter filhas — pular a
query, não só confiar que ela retornaria vazio). Essa mesma chamada
**substitui** `countSubtasks(tid)`: o `childCount` usado pra decidir
`parents` elegíveis vira `subtasks.length`, uma query a menos, uma fonte a
menos pra divergir. `countSubtasks` (`tasks.ts:157-165`) fica sem call-site
(confirmado por grep: único uso era `edit/page.tsx:34`) — remover a
função junto, não deixar código morto. `listSubtasksOf`/`listEligibleParents`
ficam sequenciais (a segunda só roda se `childCount === 0`) — igual ao
`countSubtasks`/`listEligibleParents` de hoje (já sequenciais,
`edit/page.tsx:34-36`, fora do `Promise.all` da linha 22); não piora
latência, só troca qual query roda primeiro.

**Efeito colateral aceito, registrado:** apagar a ÚLTIMA subtarefa pela
lista inline faz `childCount` cair pra 0 no re-render (`router.refresh()`),
`listEligibleParents` volta a retornar linhas, e o select "Tarefa-pai"
aparece no `TaskForm` que já estava aberto — cosmético (o formulário não
perde estado, só ganha um campo a mais), não corrigido nesta feature.

```tsx
const subtasks = task.parentTaskId === null ? await listSubtasksOf(tid) : [];
const childCount = subtasks.length;
const parents = childCount > 0 ? [] : await listEligibleParents(fid, tid);
// ...
{subtasks.length > 0 && (
  <section>
    <h2 className="font-display text-lg font-semibold text-ink mb-2">Subtarefas</h2>
    <ul className="bg-card border border-line rounded shadow-sm overflow-hidden">
      {subtasks.map((s) => (
        <TaskListItem key={s.id} task={s} operationId={id} isAdmin={profile?.role === "admin"} isSubtask />
      ))}
    </ul>
  </section>
)}
```

(`isAdmin` usa o mesmo `profile` já buscado em `edit/page.tsx:22`, igual ao
`TaskForm` logo abaixo — não é placeholder.)

### D4 — Ordenação e atalho de criação na lista inline do pai

A lista de subtarefas em `edit/page.tsx` usa a MESMA ordenação de
`listTasksByFrente` (status → due_date → created_at, done por último) — não
uma ordem nova. Sem atalho "+ subtarefa" nessa tela: `TaskListItem` já
suprime esse link quando `isSubtask` é true (`TaskListItem.tsx:88`), e
criar subtarefa continua exclusivamente pela tela da Frente — consistente
com a hierarquia de 1 nível, decisão registrada, não um requisito novo.

## Mudanças de arquivo

- `src/lib/db/queries/tasks.ts`: `resolveAssignedTaskIds`, `filterInheritedRows`,
  `listSubtasksOf`; `listTasks` reescrito pra usar os dois primeiros (embed
  de exibição sempre completo, sem `!inner`/`.eq("assignees.person_id")`,
  mais o embed dedicado `assigneeLinks:task_assignees(person_id)` só pra
  herança);
  `countTasks` reescrito conforme D2 (1 query + partição JS, sem `Promise.all` de 3);
  `crossFrenteSelect` perde o parâmetro `inner` (sempre completo agora) e o
  docblock que descreve o modo `true` (`tasks.ts:256-260`) é reescrito, não
  deixado afirmando o comportamento antigo; `countSubtasks` removida (sem
  call-site após a Fase 4 tocar `edit/page.tsx`).
- `src/app/(app)/operations/[id]/frentes/[fid]/tasks/[tid]/edit/page.tsx`:
  troca `countSubtasks(tid)` por `listSubtasksOf(tid)`, renderiza a seção
  "Subtarefas" condicional.
- `docs/workflows/tarefas.md`: reconciliar TODO trecho que descreve o
  mecanismo antigo de `/tasks`. Confirmado (gate rodada 2) que inclui pelo
  menos: a frase de `?assignee=<personId>` ("só daquela pessoa, estar
  *entre* os responsáveis" → passa a incluir herdadas); onde o doc chama
  `countTasks` de query `count:'exact'` ou de "paginação" (D2 muda pra
  fetch+partição JS); onde cita `.in("status", OPEN_STATUSES)` como
  mecanismo de `countTasks` (vira `isOpenStatus` por linha); a frase "Sem
  rollup de status — a UI só mostra 'm/n subtarefas'" (Story2 adiciona lista
  inline com `StatusCycleButton`/delete na tela do pai); e a frase sobre
  `listTasks` "continuar sem filtrar `parent_task_id`" (passa a ser caminho
  de inclusão sob filtro de responsável). **Buscar `countTasks`, `assignee=`
  E `subtarefa`/`parent_task_id` no arquivo antes de editar** — grep por um
  termo só já subestimou o total de trechos afetados 2× nas rodadas
  anteriores deste próprio artefato.
- `.specs/project/STATE.md` (AD-019): já reescrita nesta sessão (rodada 2)
  pra citar a linha crua de `task_assignees` em vez do array pós-RLS de
  `persons` — **confirmar que ainda bate com D1.3 final** (o alias dedicado
  `assigneeLinks`, não mais só "linha crua") antes de fechar a feature; não
  é mais um "a fazer", é um "conferir".
- Nenhuma migration, nenhuma mudança de RLS, nenhuma Server Action nova.
