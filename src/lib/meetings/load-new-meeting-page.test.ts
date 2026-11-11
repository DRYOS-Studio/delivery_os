import { describe, expect, it, vi } from "vitest";
import { loadNewMeetingPageData } from "@/lib/meetings/load-new-meeting-page";

vi.mock("@/lib/db/queries/operations", () => ({
  getOperation: vi.fn(),
}));

vi.mock("@/lib/db/queries/meetings", () => ({
  listAttendeeCandidates: vi.fn(),
}));

vi.mock("@/lib/db/queries/frentes", () => ({
  listActiveFrentesByOperation: vi.fn(),
}));

import { listActiveFrentesByOperation } from "@/lib/db/queries/frentes";
import { listAttendeeCandidates } from "@/lib/db/queries/meetings";
import { getOperation } from "@/lib/db/queries/operations";

const op = {
  id: "881c0252-a269-4296-8af3-d235b3c78efc",
  name: "Op teste",
  client: { id: "5d7942fe-577c-45f4-853f-822c49cbdba6", name: "Cliente" },
} as Awaited<ReturnType<typeof getOperation>>;

describe("loadNewMeetingPageData", () => {
  it("retorna null se a operação não existir", async () => {
    vi.mocked(getOperation).mockResolvedValueOnce(null);
    await expect(
      loadNewMeetingPageData("881c0252-a269-4296-8af3-d235b3c78efc"),
    ).resolves.toBeNull();
  });

  it("carrega participantes e frentes em paralelo para o formulário", async () => {
    vi.mocked(getOperation).mockResolvedValueOnce(op);
    vi.mocked(listAttendeeCandidates).mockResolvedValueOnce([
      { id: "p1", name: "Ana", kind: "internal" },
    ]);
    vi.mocked(listActiveFrentesByOperation).mockResolvedValueOnce([
      { id: "f1", name: "Principal" },
    ]);

    const data = await loadNewMeetingPageData(op!.id);
    expect(data).toEqual({
      operation: op,
      attendeeCandidates: [{ id: "p1", name: "Ana", kind: "internal" }],
      frentes: [{ id: "f1", name: "Principal" }],
    });
    expect(listAttendeeCandidates).toHaveBeenCalledWith(op!.client.id);
    expect(listActiveFrentesByOperation).toHaveBeenCalledWith(op!.id);
  });
});
