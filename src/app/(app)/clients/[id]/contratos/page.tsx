import { notFound } from "next/navigation";
import { ClientContractsSection } from "@/components/domain/ClientContractsSection";
import { requireAdmin } from "@/lib/auth/server";
import { listClientContracts } from "@/lib/db/queries/client-contracts";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<React.JSX.Element> {
  const { id } = await params;
  if (!UUID_RE.test(id)) notFound();
  await requireAdmin(`/clients/${id}/contratos`);
  const contracts = await listClientContracts(id);
  return <ClientContractsSection clientId={id} contracts={contracts} />;
}
