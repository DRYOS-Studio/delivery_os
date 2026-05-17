import { FileText, Pencil } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { BriefingView } from "@/components/domain/BriefingView";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/Card";
import { getBriefingByOperation } from "@/lib/db/queries/briefings";
import { getOperation } from "@/lib/db/queries/operations";
import { formatDateBR, relativeFromNow } from "@/lib/utils/date";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!UUID_RE.test(id)) redirect("/operations");

  const [op, briefing] = await Promise.all([
    getOperation(id),
    getBriefingByOperation(id),
  ]);
  if (!op) redirect("/operations");

  if (!briefing || !briefing.latestVersion) {
    return (
      <>
        <PageHeader
          title="Briefing"
          subtitle={`${op.client.name} · ${op.name}`}
        />
        <Card>
          <div className="flex flex-col items-center text-center py-10 gap-3">
            <FileText className="w-10 h-10 text-mute" strokeWidth={1.5} />
            <p className="text-sm text-ink-soft max-w-md">
              Esta Operação ainda não tem briefing. Crie agora pra registrar
              contexto, objetivos, escopo, premissas, riscos e stakeholders.
            </p>
            <Link
              href={`/operations/${op.id}/briefing/edit`}
              className="inline-flex items-center gap-2 rounded font-medium px-3.5 py-2 text-[13px] bg-sage text-bg hover:bg-sage-deep transition-colors"
            >
              <Pencil className="w-4 h-4" strokeWidth={1.75} />
              Criar briefing
            </Link>
          </div>
        </Card>
      </>
    );
  }

  const { latestVersion, authorEmail, versionsCount, updated_at } = briefing;

  return (
    <>
      <PageHeader
        title="Briefing"
        subtitle={`${op.client.name} · ${op.name}`}
        actions={
          <Link href={`/operations/${op.id}/briefing/edit`}>
            <button
              type="button"
              className="inline-flex items-center gap-2 rounded font-medium px-3.5 py-2 text-[13px] bg-sage text-bg hover:bg-sage-deep transition-colors"
            >
              <Pencil className="w-4 h-4" strokeWidth={1.75} />
              Editar
            </button>
          </Link>
        }
      />

      <div className="flex items-center gap-3 flex-wrap mb-6 font-mono text-[11px] text-mute">
        <span>
          Atualizado em {formatDateBR(updated_at)} · {relativeFromNow(updated_at)}
        </span>
        <span>·</span>
        <span>por {authorEmail ?? "Usuário removido"}</span>
        <span>·</span>
        <Link
          href={`/operations/${op.id}/briefing/history`}
          className="text-oak hover:underline"
        >
          Histórico ({versionsCount} {versionsCount === 1 ? "versão" : "versões"})
        </Link>
      </div>

      <BriefingView content={latestVersion} />
    </>
  );
}
