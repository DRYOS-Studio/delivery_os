import { redirect } from "next/navigation";
import { getLatestDiagnosticByClient } from "@/lib/db/queries/diagnostics";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!UUID_RE.test(id)) redirect("/clients");

  const diagnostic = await getLatestDiagnosticByClient(id);
  if (diagnostic) {
    redirect(`/clients/${id}/diagnostic/${diagnostic.id}/edit`);
  } else {
    redirect(`/clients/${id}/diagnostic/new`);
  }
}
