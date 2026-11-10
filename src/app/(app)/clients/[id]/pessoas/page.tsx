import { notFound } from "next/navigation";
import { ExternalPersonsList } from "@/components/domain/ExternalPersonsList";
import { Pill } from "@/components/ui/Pill";
import { getExternalPersonsByClient } from "@/lib/db/queries/persons";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<React.JSX.Element> {
  const { id } = await params;
  if (!UUID_RE.test(id)) notFound();
  const persons = await getExternalPersonsByClient(id);
  return (
    <section className="mb-9">
      <div className="flex items-center gap-2 mb-4">
        <h2 className="font-display text-lg text-ink font-semibold">
          Pessoas externas
        </h2>
        <Pill variant="neutral">{persons.length}</Pill>
      </div>
      <ExternalPersonsList persons={persons} />
    </section>
  );
}
