import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { Pill } from "@/components/ui/Pill";
import { PageHeader } from "@/components/layout/PageHeader";
import { requireAdmin } from "@/lib/auth/server";
import { listPendingUnmappedNtfyAlerts } from "@/lib/db/queries/ntfy-unmapped";
import { formatDateTimeBR } from "@/lib/utils/datetime";

export default async function Page(): Promise<React.JSX.Element> {
  await requireAdmin("/operations");
  const items = await listPendingUnmappedNtfyAlerts(100);

  return (
    <>
      <PageHeader
        title="Triagem ntfy"
        subtitle="Alertas sem tópico mapeado (não descartados)"
        actions={
          <Link href="/operations" className="font-mono text-xs text-oak hover:underline">
            ← Operações
          </Link>
        }
      />
      {items.length === 0 ? (
        <Card>
          <p className="text-sm text-mute text-center py-4">
            Nenhum alerta pendente de mapeamento.
          </p>
        </Card>
      ) : (
        <ul className="space-y-2">
          {items.map((a) => (
            <li key={a.id}>
              <Card>
                <div className="flex flex-wrap items-center gap-2 mb-2">
                  <Pill variant="warning">não mapeado</Pill>
                  <span className="font-mono text-sm text-ink">{a.topic}</span>
                  <span className="text-xs text-mute">
                    {formatDateTimeBR(a.received_at)}
                  </span>
                </div>
                {a.title && (
                  <p className="font-semibold text-ink text-sm">{a.title}</p>
                )}
                {a.message && (
                  <p className="text-sm text-ink-soft whitespace-pre-wrap mt-1">
                    {a.message}
                  </p>
                )}
                <p className="text-xs text-mute mt-2 font-mono">
                  id: {a.ntfy_message_id}
                </p>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
