import { notFound, redirect } from "next/navigation";
import { ClientCacForm } from "@/components/domain/ClientCacForm";
import { getProfile } from "@/lib/auth/server";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function ClientCacNewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<React.JSX.Element> {
  const { id } = await params;
  if (!UUID_RE.test(id)) notFound();
  const profile = await getProfile();
  if (profile?.role !== "admin") redirect(`/clients/${id}`);

  return <ClientCacForm mode="create" clientId={id} />;
}
