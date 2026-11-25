import { describe, expect, it } from "vitest";
import { dedupeAttendeeCandidates } from "@/lib/db/queries/meetings-attendee-candidates";

// Contrato: client_id inválido não deve chegar ao PostgREST (evita parse filter).
describe("listAttendeeCandidates guard", () => {
  it("rejeita client_id inválido antes do Supabase", async () => {
    const { listAttendeeCandidates } = await import("@/lib/db/queries/meetings");
    await expect(listAttendeeCandidates("")).rejects.toThrow(
      /listAttendeeCandidates: client_id inválido/,
    );
    await expect(listAttendeeCandidates("not-a-uuid")).rejects.toThrow(
      /listAttendeeCandidates: client_id inválido/,
    );
  });
});

describe("dedupeAttendeeCandidates", () => {
  it("remove ids repetidos", () => {
    const rows = dedupeAttendeeCandidates([
      { id: "a", name: "A", kind: "internal" as const },
      { id: "a", name: "B", kind: "external" as const },
      { id: "b", name: "C", kind: "internal" as const },
    ]);
    expect(rows.map((r) => r.id)).toEqual(["a", "b"]);
  });
});