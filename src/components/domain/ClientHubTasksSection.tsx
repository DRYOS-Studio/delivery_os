import Link from "next/link";
import type { ClientHubTask } from "@/lib/db/queries/client-hub";
import { Pill, type PillVariant } from "@/components/ui/Pill";
import { formatDateBR } from "@/lib/utils/date";

function statusVariant(status: ClientHubTask["status"]): PillVariant {
  switch (status) {
    case "todo":
      return "neutral";
    case "doing":
      return "sage";
    case "blocked":
      return "warning";
    case "done":
      return "ok";
    default: {
      const _exhaustive: never = status;
      return _exhaustive;
    }
  }
}

const STATUS_LABEL: Record<ClientHubTask["status"], string> = {
  todo: "A fazer",
  doing: "Em andamento",
  blocked: "Bloqueada",
  done: "Concluída",
};

type Props = {
  tasks: ClientHubTask[];
};

export function ClientHubTasksSection({ tasks }: Props): React.JSX.Element {
  return (
    <section className="mb-9">
      <div className="flex items-center gap-2 mb-4">
        <h2 className="font-display text-lg text-ink font-semibold">
          Tarefas abertas
        </h2>
        <Pill variant="neutral">{tasks.length}</Pill>
      </div>
      {tasks.length === 0 ? (
        <p className="text-sm text-mute">
          Nenhuma tarefa aberta vinculada às Operações deste cliente.
        </p>
      ) : (
        <div className="bg-card border border-line rounded shadow-sm overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line text-left text-mute font-mono text-[10px] uppercase tracking-wide">
                <th className="px-3 py-2">Tarefa</th>
                <th className="px-3 py-2">Operação</th>
                <th className="px-3 py-2">Contexto</th>
                <th className="px-3 py-2">Responsáveis</th>
                <th className="px-3 py-2">Prazo</th>
                <th className="px-3 py-2">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {tasks.map((t) => {
                const href =
                  t.kind === "entrega" && t.frenteId
                    ? `/operations/${t.operationId}/frentes/${t.frenteId}/tasks/${t.id}/edit`
                    : `/operations/${t.operationId}/areas/${t.id}/edit`;
                const context =
                  t.kind === "area"
                    ? t.areaName ?? "Área"
                    : t.frenteName ?? "Frente";
                return (
                  <tr key={t.id} className="hover:bg-surface/40">
                    <td className="px-3 py-2">
                      <Link
                        href={href}
                        className="text-oak hover:underline font-medium text-ink"
                      >
                        {t.title}
                      </Link>
                    </td>
                    <td className="px-3 py-2 text-ink-soft">
                      <Link
                        href={`/operations/${t.operationId}`}
                        className="hover:underline"
                      >
                        {t.operationName}
                      </Link>
                    </td>
                    <td className="px-3 py-2 text-mute">{context}</td>
                    <td className="px-3 py-2 text-ink-soft">
                      {t.assigneeNames.length > 0
                        ? t.assigneeNames.join(", ")
                        : "—"}
                    </td>
                    <td className="px-3 py-2 font-mono text-xs text-mute">
                      {formatDateBR(t.dueDate)}
                    </td>
                    <td className="px-3 py-2">
                      <Pill variant={statusVariant(t.status)}>
                        {STATUS_LABEL[t.status]}
                      </Pill>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
