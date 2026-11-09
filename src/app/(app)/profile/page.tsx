import { ProfileDisplayNameForm } from "@/components/domain/ProfileDisplayNameForm";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/Card";
import { requireProfile } from "@/lib/auth/server";
import { createServer } from "@/lib/db/client";
import {
  pickProfileDisplayName,
  resolveProfileDisplayNames,
} from "@/lib/db/queries/profile-display-names";

export default async function ProfilePage(): Promise<React.JSX.Element> {
  const profile = await requireProfile("/profile");
  const supabase = await createServer();
  const { data: row, error } = await supabase
    .from("profiles")
    .select("name")
    .eq("id", profile.user.id)
    .maybeSingle();
  if (error) throw new Error(`profile page: ${error.message}`);

  const names = await resolveProfileDisplayNames([profile.user.id]);
  const resolvedLabel = pickProfileDisplayName(names, profile.user.id);
  const email = profile.user.email ?? null;

  return (
    <>
      <PageHeader
        title="Meu perfil"
        subtitle="Nome exibido em comentários, histórico e listas"
      />
      <Card className="max-w-lg">
        <p className="text-xs font-mono text-mute mb-4">{email ?? "—"}</p>
        <ProfileDisplayNameForm
          profileId={profile.user.id}
          initialName={row?.name ?? null}
          resolvedLabel={resolvedLabel}
          email={email}
          canEdit
        />
      </Card>
    </>
  );
}
