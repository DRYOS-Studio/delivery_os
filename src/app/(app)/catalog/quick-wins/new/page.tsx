import { notFound } from "next/navigation";
import { QuickWinCatalogForm } from "@/components/domain/QuickWinCatalogForm";
import { PageHeader } from "@/components/layout/PageHeader";
import { getProfile } from "@/lib/auth/server";
import { listVillains } from "@/lib/db/queries/villains";

export default async function Page() {
  const [profile, villains] = await Promise.all([
    getProfile(),
    listVillains(),
  ]);
  if (profile?.role !== "admin") notFound();

  return (
    <>
      <PageHeader
        title="Novo tipo"
        subtitle="Cadastre um tipo de Quick Win no catálogo."
      />
      <QuickWinCatalogForm mode="create" villains={villains} />
    </>
  );
}
