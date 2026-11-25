import { redirect } from "next/navigation";
import { MeetingFormDynamic } from "@/components/domain/MeetingFormDynamic";
import { PageHeader } from "@/components/layout/PageHeader";
import { loadNewMeetingPageData } from "@/lib/meetings/load-new-meeting-page";
import { isActiveStatus } from "@/lib/utils/operation-status";
import { UUID_RE } from "@/lib/utils/uuid";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{ kind?: string; returnTo?: string }>;

export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: SearchParams;
}) {
  const { id } = await params;
  const { kind, returnTo } = await searchParams;
  const defaultKind = kind === "onboarding" ? "onboarding" : "general";
  const safeReturnTo =
    returnTo?.startsWith("/clients/") || returnTo?.startsWith("/operations/")
      ? returnTo
      : undefined;
  if (!UUID_RE.test(id)) redirect("/operations");

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
}
