import { PageHeader } from "@/components/layout/PageHeader";

export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <>
      <PageHeader title="Operação" subtitle="Em construção · sem 03" />
      <p className="font-mono text-xs text-mute">id: {id}</p>
    </>
  );
}
