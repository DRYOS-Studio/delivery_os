import { notFound, redirect } from "next/navigation";
import { ClientCacSection } from "@/components/domain/ClientCacSection";
import { getProfile } from "@/lib/auth/server";
import {
  listClientAcquisitionCosts,
  sumClientAcquisitionCosts,
} from "@/lib/db/queries/client-acquisition-costs";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function ClientCacPage({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<React.JSX.Element> {
  const { id } = await params;
  if (!UUID_RE.test(id)) notFound();
  const profile = await getProfile();
  if (profile?.role !== "admin") redirect(`/clients/${id}`);

  const [items, totalCac] = await Promise.all([
    listClientAcquisitionCosts(id),
    sumClientAcquisitionCosts(id),
  ]);

  return (
    <ClientCacSection clientId={id} items={items} totalCac={totalCac} />
  );
}
