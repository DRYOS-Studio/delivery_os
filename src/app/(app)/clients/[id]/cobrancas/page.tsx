import { notFound } from "next/navigation";
import { ClientChargesSection } from "@/components/domain/ClientChargesSection";
import { requireAdmin } from "@/lib/auth/server";
import { listClientCharges } from "@/lib/db/queries/client-charges";
import { listClientContracts } from "@/lib/db/queries/client-contracts";
import { getClientOperationsMrrSum } from "@/lib/db/queries/operations";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<React.JSX.Element> {
  const { id } = await params;
  if (!UUID_RE.test(id)) notFound();
  await requireAdmin(`/clients/${id}/cobrancas`);
  const [contracts, charges, registeredMrr] = await Promise.all([
    listClientContracts(id),
    listClientCharges(id, { limit: 120 }),
    getClientOperationsMrrSum(id),
  ]);
  return (
    <ClientChargesSection
      clientId={id}
      charges={charges}
      contracts={contracts}
      registeredMrr={registeredMrr}
    />
  );
}
