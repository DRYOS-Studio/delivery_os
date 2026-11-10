import { notFound, redirect } from "next/navigation";
import { ClientCacForm } from "@/components/domain/ClientCacForm";
import { getProfile } from "@/lib/auth/server";
import { getClientAcquisitionCost } from "@/lib/db/queries/client-acquisition-costs";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function ClientCacEditPage({
  params,
}: {
  params: Promise<{ id: string; itemId: string }>;
}): Promise<React.JSX.Element> {
  const { id, itemId } = await params;
  if (!UUID_RE.test(id) || !UUID_RE.test(itemId)) notFound();
  const profile = await getProfile();
  if (profile?.role !== "admin") redirect(`/clients/${id}`);

  const item = await getClientAcquisitionCost(itemId);
  if (!item || item.clientId !== id) notFound();

  return <ClientCacForm mode="edit" clientId={id} item={item} />;
}
