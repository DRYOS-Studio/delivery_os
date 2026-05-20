import { notFound } from "next/navigation";
import { QuickWinCatalogForm } from "@/components/domain/QuickWinCatalogForm";
import { PageHeader } from "@/components/layout/PageHeader";
import { getProfile } from "@/lib/auth/server";
import { getQuickWinCatalogItem } from "@/lib/db/queries/quick-win-catalog";
import { listVillains } from "@/lib/db/queries/villains";

export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [profile, item, villains] = await Promise.all([
    getProfile(),
    getQuickWinCatalogItem(id),
    listVillains(),
  ]);
  if (profile?.role !== "admin") notFound();
  if (!item) notFound();

  return (
    <>
      <PageHeader
        title={`Editar · ${item.title}`}
        subtitle="Ajustar título, descrição, vilão sugerido ou impacto."
      />
      <QuickWinCatalogForm
        mode="edit"
        initialData={item}
        villains={villains}
      />
    </>
  );
}
