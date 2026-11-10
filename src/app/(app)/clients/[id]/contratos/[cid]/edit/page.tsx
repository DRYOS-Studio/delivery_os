import { notFound } from "next/navigation";
import { ClientContractForm } from "@/components/domain/ClientContractForm";
import { requireAdmin } from "@/lib/auth/server";
import { getClientContract } from "@/lib/db/queries/client-contracts";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function Page({
  params,
}: {
  params: Promise<{ id: string; cid: string }>;
}): Promise<React.JSX.Element> {
  const { id, cid } = await params;
  if (!UUID_RE.test(id) || !UUID_RE.test(cid)) notFound();
  await requireAdmin(`/clients/${id}/contratos/${cid}/edit`);
  const contract = await getClientContract(cid);
  if (!contract || contract.clientId !== id) notFound();
  return (
    <ClientContractForm mode="edit" clientId={id} contract={contract} />
  );
}
