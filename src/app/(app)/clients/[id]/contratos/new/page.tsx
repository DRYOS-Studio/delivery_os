import { notFound } from "next/navigation";
import { ClientContractForm } from "@/components/domain/ClientContractForm";
import { requireAdmin } from "@/lib/auth/server";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<React.JSX.Element> {
  const { id } = await params;
  if (!UUID_RE.test(id)) notFound();
  await requireAdmin(`/clients/${id}/contratos/new`);
  return <ClientContractForm mode="create" clientId={id} />;
}
