import { createAdmin, createServer } from "@/lib/db/client";
import type { Database } from "@/lib/db/types";

export type PublicLinkRow = Database["public"]["Tables"]["public_links"]["Row"];

export type PublicLinkListItem = {
  id: string;
  token: string;
  label: string | null;
  lastAccessedAt: string | null;
  revokedAt: string | null;
  expiresAt: string | null;
  createdAt: string;
};

export type PublicLinkResolved = {
  id: string;
  operationId: string;
};

export async function listPublicLinksByOperation(
  operationId: string,
): Promise<PublicLinkListItem[]> {
  const supabase = await createServer();
  const { data, error } = await supabase
    .from("public_links")
    .select(
      "id, token, label, last_accessed_at, revoked_at, expires_at, created_at",
    )
    .eq("operation_id", operationId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(`listPublicLinksByOperation: ${error.message}`);
  if (!data) return [];
  return data.map((r) => ({
    id: r.id,
    token: r.token,
    label: r.label,
    lastAccessedAt: r.last_accessed_at,
    revokedAt: r.revoked_at,
    expiresAt: r.expires_at,
    createdAt: r.created_at,
  }));
}

// Server-only helper. Fire-and-forget update; silenciosamente ignora erros.
export async function touchPublicLinkAccess(linkId: string): Promise<void> {
  try {
    const admin = createAdmin();
    await admin
      .from("public_links")
      .update({ last_accessed_at: new Date().toISOString() })
      .eq("id", linkId);
  } catch {
    // silent
  }
}

// Expirado só quando JÁ passou (igualdade exata = válido); ambos os lados em epoch —
// ISO com offset não ordena como string. Único ponto com essa semântica: usado pelo
// resolver (enforcement) e pela UI de admin (display) pra nunca divergirem.
export function isLinkExpired(expiresAt: string | null): boolean {
  return expiresAt !== null && new Date(expiresAt).getTime() < Date.now();
}

// Server-only. Usa createAdmin pra bypassar RLS — chamado pela rota pública sem auth.
// Ponto único de validade do link: retorna null se revogado, expirado ou com a
// operação arquivada — página e rota de download checam só `!link`.
export async function getPublicLinkByToken(
  token: string,
): Promise<PublicLinkResolved | null> {
  const admin = createAdmin();
  const { data, error } = await admin
    .from("public_links")
    .select(
      "id, operation_id, revoked_at, expires_at, operation:operations!fk_public_links_operation_id(archived_at)",
    )
    .eq("token", token)
    .maybeSingle();
  if (error) throw new Error(`getPublicLinkByToken: ${error.message}`);
  if (!data) return null;
  if (data.revoked_at !== null) return null;
  if (isLinkExpired(data.expires_at)) return null;
  const operation = Array.isArray(data.operation)
    ? (data.operation[0] ?? null)
    : data.operation;
  // Embed ausente (não deveria ocorrer; FK NOT NULL) também invalida — default seguro.
  if (operation?.archived_at !== null) return null;
  return {
    id: data.id,
    operationId: data.operation_id,
  };
}
