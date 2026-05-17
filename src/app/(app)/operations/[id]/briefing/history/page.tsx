import { redirect } from "next/navigation";
import { BriefingHistoryList } from "@/components/domain/BriefingHistoryList";
import { PageHeader } from "@/components/layout/PageHeader";
import {
  getBriefingByOperation,
  listBriefingVersions,
} from "@/lib/db/queries/briefings";
import { getOperation } from "@/lib/db/queries/operations";

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
  if (!briefing) redirect(`/operations/${id}/briefing`);

  const versions = await listBriefingVersions(briefing.id);

  return (
    <>
      <PageHeader
        title="Histórico do briefing"
        subtitle={`${op.client.name} · ${op.name}`}
      />
      <BriefingHistoryList
        versions={versions}
        currentVersionId={briefing.current_version_id}
        operationId={op.id}
      />
    </>
  );
}
