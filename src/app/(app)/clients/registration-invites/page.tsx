import { Link2, Plus } from "lucide-react";
import Link from "next/link";
import { RegistrationInviteCreateForm } from "@/components/domain/RegistrationInviteCreateForm";
import { RegistrationInvitesTable } from "@/components/domain/RegistrationInvitesTable";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/Button";
import { requireAdmin } from "@/lib/auth/server";
import { createServer } from "@/lib/db/client";
import { listRegistrationInvitations } from "@/lib/db/queries/client-registration-invitations";

type SearchParams = Promise<{ new?: string }>;

export default async function RegistrationInvitesPage({
  searchParams,
}: {
  searchParams: SearchParams;
}): Promise<React.JSX.Element> {
  await requireAdmin("/clients");
  const { new: showNew } = await searchParams;
  const supabase = await createServer();
  const items = await listRegistrationInvitations(supabase);

  return (
    <>
      <PageHeader
        title="Cadastro por link"
        subtitle="Convites enviados ao cliente para autocadastro"
        actions={
          showNew === "1" ? (
            <Link href="/clients/registration-invites">
              <Button variant="ghost">Ver lista</Button>
            </Link>
          ) : (
            <Link href="/clients/registration-invites?new=1">
              <Button variant="sage">
                <Plus className="w-4 h-4" strokeWidth={1.75} />
                Novo cadastro por link
              </Button>
            </Link>
          )
        }
      />
      {showNew === "1" ? (
        <RegistrationInviteCreateForm />
      ) : (
        <>
          <p className="text-sm text-mute mb-4 flex items-center gap-2">
            <Link2 className="w-4 h-4 text-oak" strokeWidth={1.75} />
            O cliente preenche em /cadastro/&lt;token&gt; — nada é criado em clients
            até você aprovar.
          </p>
          <RegistrationInvitesTable items={items} />
        </>
      )}
    </>
  );
}
