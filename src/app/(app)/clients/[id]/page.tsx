import { notFound, redirect } from "next/navigation";
import { clientHubPathFromLegacyTab } from "@/lib/utils/client-hub-tabs";
import { ClientFinancialOverview } from "@/components/domain/ClientFinancialOverview";
import { ClientJourneyPanel } from "@/components/domain/ClientJourneyPanel";
import { ClientSummarySection } from "@/components/domain/ClientSummarySection";
import { getProfile } from "@/lib/auth/server";
import { getClientFinancialSummary } from "@/lib/db/queries/client-financial-summary";
import { getClient, getClientSummary } from "@/lib/db/queries/clients";
import { getActiveOperations } from "@/lib/db/queries/operations";
import { logRouteError } from "@/lib/utils/log-route-error";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function ClientVisaoPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}): Promise<React.JSX.Element> {
  const { id } = await params;
  if (!UUID_RE.test(id)) notFound();
  const sp = searchParams ? await searchParams : undefined;
  const tabRaw = sp?.tab;
  const tab = Array.isArray(tabRaw) ? tabRaw[0] : tabRaw;
  const legacy = clientHubPathFromLegacyTab(id, tab);
  if (legacy && legacy !== `/clients/${id}`) redirect(legacy);
  const route = `/clients/${id}`;
  let client;
  try {
    client = await getClient(id);
  } catch (error) {
    logRouteError(route, error, { clientId: id, phase: "getClient" });
    throw error;
  }
  if (!client) notFound();
  let profile;
  try {
    profile = await getProfile();
  } catch (error) {
    logRouteError(route, error, { clientId: id, phase: "getProfile" });
    throw error;
  }
  const isAdmin = profile?.role === "admin";
  let operations;
  let summary;
  let financial;
  try {
    [operations, summary, financial] = await Promise.all([
      getActiveOperations({ clientId: id, scope: "visivel" }),
      getClientSummary(id),
      isAdmin
        ? getClientFinancialSummary(id, { includeCac: true })
        : Promise.resolve(null),
    ]);
  } catch (error) {
    logRouteError(route, error, { clientId: id, phase: "batch" });
    throw error;
  }

  return (
    <div className="space-y-7">
      <ClientJourneyPanel
        client={client}
        operations={operations}
        isAdmin={isAdmin}
      />
      {isAdmin && financial && (
        <ClientFinancialOverview clientId={id} financial={financial} />
      )}
      {client.notes && (
        <div className="bg-sage-bg border-l-2 border-sage-deep px-4 py-3 rounded-sm">
          <p className="font-body text-sm text-ink-soft whitespace-pre-wrap">
            {client.notes}
          </p>
        </div>
      )}
      <ClientSummarySection summary={summary} />
    </div>
  );
}
