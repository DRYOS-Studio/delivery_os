import { redirect } from "next/navigation";
import { MeetingFormDynamic } from "@/components/domain/MeetingFormDynamic";
import { PageHeader } from "@/components/layout/PageHeader";
import { loadNewMeetingPageData } from "@/lib/meetings/load-new-meeting-page";
import { logRouteError } from "@/lib/utils/log-route-error";
import { isActiveStatus } from "@/lib/utils/operation-status";
import { parseNewMeetingSearchParams } from "@/lib/utils/search-params";
import { UUID_RE } from "@/lib/utils/uuid";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{
  kind?: string | string[];
  returnTo?: string | string[];
}>;

export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: SearchParams;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const { defaultKind, returnTo: safeReturnTo } = parseNewMeetingSearchParams(sp);
  const route = `/operations/${id}/meetings/new`;

  if (!UUID_RE.test(id)) redirect("/operations");

  try {
    const loaded = await loadNewMeetingPageData(id);
    if (!loaded) redirect("/operations");
    const { operation: op, attendeeCandidates, frentes } = loaded;
    // Barra qualquer status terminal, não só o legado `arquivada`: contrato
    // encerrado não recebe registro novo.
    if (!isActiveStatus(op.status)) redirect(`/operations/${id}`);

    return (
      <>
        <PageHeader
          title="Nova reunião"
          subtitle={`${op.client.name} · ${op.name}`}
        />
        <MeetingFormDynamic
          mode="create"
          operationId={op.id}
          clientName={op.client.name}
          attendeeCandidates={attendeeCandidates}
          frentes={frentes}
          {...(defaultKind === "onboarding" ? { defaultKind } : {})}
          {...(safeReturnTo ? { returnTo: safeReturnTo } : {})}
        />
      </>
    );
  } catch (error) {
    logRouteError(route, error, {
      operationId: id,
      kind: defaultKind,
      hasReturnTo: safeReturnTo ? "1" : "0",
    });
    throw error;
  }
}