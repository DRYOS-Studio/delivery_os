import type { Role } from "@/lib/auth/server";
import { createAdmin, createServer } from "@/lib/db/client";
import {
  pickProfileDisplayName,
  resolveProfileDisplayNames,
} from "@/lib/db/queries/profile-display-names";

export type ProfileListItem = {
  id: string;
  email: string | null;
  name: string | null;
  role: Role;
  createdAt: string;
  personId: string | null;
  personName: string | null;
  displayLabel: string | null;
};

export async function listProfiles(): Promise<ProfileListItem[]> {
  const supabase = await createServer();
  const { data, error } = await supabase
    .from("profiles")
    .select(
      `
      id, role, name, created_at, person_id,
      person:persons!fk_profiles_person_id ( id, name )
      `,
    )
    .order("created_at", { ascending: true });
  if (error) throw new Error(`listProfiles: ${error.message}`);
  if (!data) return [];

  const admin = createAdmin();
  const displayNames = await resolveProfileDisplayNames(data.map((p) => p.id));
  const result: ProfileListItem[] = [];
  for (const p of data) {
    const { data: u } = await admin.auth.admin.getUserById(p.id);
    const person = p.person as { id: string; name: string } | null;
    result.push({
      id: p.id,
      email: u?.user?.email ?? null,
      name: p.name,
      role: p.role as Role,
      createdAt: p.created_at,
      personId: p.person_id,
      personName: person?.name ?? null,
      displayLabel: pickProfileDisplayName(displayNames, p.id),
    });
  }
  return result;
}
