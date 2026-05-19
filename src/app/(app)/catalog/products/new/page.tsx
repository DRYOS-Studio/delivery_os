import { notFound } from "next/navigation";
import { ProductForm } from "@/components/domain/ProductForm";
import { PageHeader } from "@/components/layout/PageHeader";
import { getProfile } from "@/lib/auth/server";

export default async function Page() {
  const profile = await getProfile();
  if (profile?.role !== "admin") notFound();

  return (
    <>
      <PageHeader
        title="Novo produto"
        subtitle="Cadastre um produto/serviço DRYOS no catálogo."
      />
      <ProductForm mode="create" />
    </>
  );
}
