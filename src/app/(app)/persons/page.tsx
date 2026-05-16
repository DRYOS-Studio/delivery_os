import { Plus } from "lucide-react";
import Link from "next/link";
import { PersonsSearch } from "@/components/domain/PersonsSearch";
import { PersonsTable } from "@/components/domain/PersonsTable";
import { PersonsTabs } from "@/components/domain/PersonsTabs";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/Button";
import {
  countActivePersons,
  listPersons,
} from "@/lib/db/queries/persons";

type SearchParams = Promise<{
  kind?: "internal" | "external" | "all";
  q?: string;
}>;

export default async function Page({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  const activeKind: "internal" | "external" | "all" =
    params.kind === "internal" || params.kind === "external"
      ? params.kind
      : "all";
  const q = params.q;

  const [persons, counts] = await Promise.all([
    listPersons({
      kind: activeKind === "all" ? undefined : activeKind,
      search: q,
    }),
    countActivePersons(),
  ]);

  const hasFilter = activeKind !== "all" || !!q;
  const subtitle = `${counts.total} ${counts.total === 1 ? "pessoa ativa" : "pessoas ativas"}`;

  return (
    <>
      <PageHeader
        title="Pessoas"
        subtitle={subtitle}
        actions={
          <Link href="/persons/new">
            <Button variant="sage">
              <Plus className="w-4 h-4" strokeWidth={1.75} />
              Nova pessoa
            </Button>
          </Link>
        }
      />
      <PersonsTabs counts={counts} activeKind={activeKind} />
      <PersonsSearch initialQuery={q ?? ""} />
      <PersonsTable persons={persons} hasFilter={hasFilter} />
    </>
  );
}
