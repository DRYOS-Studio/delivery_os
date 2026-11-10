import { notFound } from "next/navigation";
import { ClientChargeForm } from "@/components/domain/ClientChargeForm";
import { requireAdmin } from "@/lib/auth/server";
import { getClientCharge } from "@/lib/db/queries/client-charges";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function Page({
  params,
}: {
  params: Promise<{ id: string; chargeId: string }>;
}): Promise<React.JSX.Element> {
  const { id, chargeId } = await params;
  if (!UUID_RE.test(id) || !UUID_RE.test(chargeId)) notFound();
  await requireAdmin(`/clients/${id}/cobrancas/${chargeId}/edit`);
  const charge = await getClientCharge(chargeId);
  if (!charge || charge.clientId !== id) notFound();
  return <ClientChargeForm clientId={id} charge={charge} />;
}
