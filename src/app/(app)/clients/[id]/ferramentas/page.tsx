import { notFound } from "next/navigation";
import { ClientToolingSection } from "@/components/domain/ClientToolingSection";
import { getProfile } from "@/lib/auth/server";
import {
  listClientSoftwareItems,
  listClientTechItems,
} from "@/lib/db/queries/client-tooling";
import { listRepositoryLinksForClient } from "@/lib/db/queries/repository-links";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<React.JSX.Element> {
  const { id } = await params;
  if (!UUID_RE.test(id)) notFound();
  const [profile, repoLinks, techItems, softwareItems] = await Promise.all([
    getProfile(),
    listRepositoryLinksForClient(id),
    listClientTechItems(id),
    listClientSoftwareItems(id),
  ]);
  return (
    <ClientToolingSection
      clientId={id}
      isAdmin={profile?.role === "admin"}
      repoLinks={repoLinks}
      techItems={techItems}
      softwareItems={softwareItems}
    />
  );
}
