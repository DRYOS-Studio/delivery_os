import { notFound } from "next/navigation";
import { ClientIdentitySection } from "@/components/domain/ClientIdentitySection";
import { getClient } from "@/lib/db/queries/clients";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<React.JSX.Element> {
  const { id } = await params;
  if (!UUID_RE.test(id)) notFound();
  const client = await getClient(id);
  if (!client) notFound();
  return <ClientIdentitySection client={client} />;
}
