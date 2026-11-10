import { notFound } from "next/navigation";
import { ClientDiagnosticSection } from "@/components/domain/ClientDiagnosticSection";
import { getDiagnosticByClient } from "@/lib/db/queries/diagnostics";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<React.JSX.Element> {
  const { id } = await params;
  if (!UUID_RE.test(id)) notFound();
  const diagnostic = await getDiagnosticByClient(id);
  return <ClientDiagnosticSection diagnostic={diagnostic} clientId={id} />;
}
