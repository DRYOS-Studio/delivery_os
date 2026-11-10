import { notFound } from "next/navigation";
import { ClientHubTasksSection } from "@/components/domain/ClientHubTasksSection";
import { listOpenTasksForClient } from "@/lib/db/queries/client-hub";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<React.JSX.Element> {
  const { id } = await params;
  if (!UUID_RE.test(id)) notFound();
  const tasks = await listOpenTasksForClient(id);
  return <ClientHubTasksSection tasks={tasks} />;
}
