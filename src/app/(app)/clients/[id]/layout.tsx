import { Edit2 } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ClientHubNav } from "@/components/domain/ClientHubNav";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/Button";
import { getProfile } from "@/lib/auth/server";
import { getClient } from "@/lib/db/queries/clients";
import { createServer } from "@/lib/db/client";
import { checkClientVaultAccess } from "@/lib/vault/client-vault-access";
import { formatDateBR } from "@/lib/utils/date";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function ClientHubLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}): Promise<React.JSX.Element> {
  const { id } = await params;
  if (!UUID_RE.test(id)) notFound();
  const client = await getClient(id);
  if (!client) notFound();
  const profile = await getProfile();
  const isAdmin = profile?.role === "admin";
  const supabase = await createServer();
  const vaultAccess = isAdmin
    ? { kind: "allowed" as const }
    : await checkClientVaultAccess(supabase, id);
  const canAccessVault = vaultAccess.kind === "allowed";

  return (
    <>
      <PageHeader
        title={client.name}
        subtitle={
          <>
            <span className="font-mono">{client.slug}</span>
            <span className="mx-2">·</span>
            criado em {formatDateBR(client.created_at)}
          </>
        }
        actions={
          isAdmin ? (
            <Link href={`/clients/${client.id}/edit`}>
              <Button variant="ghost">
                <Edit2 className="w-4 h-4" strokeWidth={1.75} />
                Editar
              </Button>
            </Link>
          ) : undefined
        }
      />
      <ClientHubNav
        clientId={id}
        isAdmin={isAdmin}
        canAccessVault={canAccessVault}
      />
      {children}
    </>
  );
}
