import Link from "next/link";
import { redirect } from "next/navigation";
import { BriefingView } from "@/components/domain/BriefingView";
import { PageHeader } from "@/components/layout/PageHeader";
import {
  getBriefingByOperation,
  getBriefingVersion,
} from "@/lib/db/queries/briefings";
import { getOperation } from "@/lib/db/queries/operations";
import { formatDateBR, relativeFromNow } from "@/lib/utils/date";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function Page({
  params,
}: {
  params: Promise<{ id: string; vid: string }>;
}) {
  const { id, vid } = await params;
  if (!UUID_RE.test(id) || !UUID_RE.test(vid)) redirect("/operations");

  const [op, briefing, version] = await Promise.all([
    getOperation(id),
    getBriefingByOperation(id),
    getBriefingVersion(vid),
  ]);
  if (!op) redirect("/operations");
  if (!briefing) redirect(`/operations/${id}/briefing`);
  if (!version || version.briefing_id !== briefing.id) {
    redirect(`/operations/${id}/briefing/history`);
  }

  const isCurrent = briefing.current_version_id === version.id;

  return (
    <>
      <PageHeader
        title={`Versão de ${formatDateBR(version.created_at)}`}
        subtitle={`${op.client.name} · ${op.name}`}
      />

      <div className="flex items-center gap-3 flex-wrap mb-6 font-mono text-[11px] text-mute">
        {isCurrent && (
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 font-mono text-[10px] font-medium rounded-pill bg-sage-bg text-sage">
            Atual
          </span>
        )}
        <span>{relativeFromNow(version.created_at)}</span>
        <span>·</span>
        <span>por {version.authorEmail ?? "Usuário removido"}</span>
        <span>·</span>
        <Link
          href={`/operations/${op.id}/briefing/history`}
          className="text-oak hover:underline"
        >
          ← Voltar pro histórico
        </Link>
      </div>

      <BriefingView content={version} />
    </>
  );
}
