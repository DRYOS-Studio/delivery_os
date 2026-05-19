import { notFound } from "next/navigation";
import { ProductForm } from "@/components/domain/ProductForm";
import { PageHeader } from "@/components/layout/PageHeader";
import { getProfile } from "@/lib/auth/server";
import { getServiceProduct } from "@/lib/db/queries/service-products";

export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [profile, product] = await Promise.all([
    getProfile(),
    getServiceProduct(id),
  ]);
  if (profile?.role !== "admin") notFound();
  if (!product) notFound();

  return (
    <>
      <PageHeader
        title={`Editar · ${product.name}`}
        subtitle="Mudar nome, slug, descrição ou ciclo padrão."
      />
      <ProductForm mode="edit" initialData={product} />
    </>
  );
}
