import { describe, expect, it, vi } from "vitest";

const maybeSingle = vi.fn();

vi.mock("@/lib/db/client", () => ({
  createServer: vi.fn(async () => ({
    from: () => ({
      select: () => ({
        eq: () => ({
          is: () => ({
            maybeSingle,
          }),
        }),
      }),
    }),
  })),
}));

import { getOperationMeetingContext } from "@/lib/db/queries/operation-meeting-context";

describe("getOperationMeetingContext", () => {
  it("normaliza embed client como array (PostgREST)", async () => {
    maybeSingle.mockResolvedValueOnce({
      data: {
        id: "881c0252-a269-4296-8af3-d235b3c78efc",
        name: "Op",
        catalog_group: "dryos_os",
        product_line: "core",
        status: "em_operacao",
        client: [
          {
            id: "5d7942fe-577c-45f4-853f-822c49cbdba6",
            name: "Cliente",
            slug: "cliente",
            archived_at: null,
          },
        ],
      },
      error: null,
    });

    const ctx = await getOperationMeetingContext(
      "881c0252-a269-4296-8af3-d235b3c78efc",
    );
    expect(ctx?.client.id).toBe("5d7942fe-577c-45f4-853f-822c49cbdba6");
  });

  it("retorna null se cliente arquivado", async () => {
    maybeSingle.mockResolvedValueOnce({
      data: {
        id: "881c0252-a269-4296-8af3-d235b3c78efc",
        name: "Op",
        catalog_group: "dryos_os",
        product_line: "core",
        status: "em_operacao",
        client: {
          id: "5d7942fe-577c-45f4-853f-822c49cbdba6",
          name: "Cliente",
          slug: "cliente",
          archived_at: "2026-01-01T00:00:00Z",
        },
      },
      error: null,
    });
    await expect(
      getOperationMeetingContext("881c0252-a269-4296-8af3-d235b3c78efc"),
    ).resolves.toBeNull();
  });

  it("retorna null se embed client vazio", async () => {
    maybeSingle.mockResolvedValueOnce({
      data: {
        id: "881c0252-a269-4296-8af3-d235b3c78efc",
        name: "Op",
        catalog_group: "dryos_os",
        product_line: "core",
        status: "em_operacao",
        client: [],
      },
      error: null,
    });
    await expect(
      getOperationMeetingContext("881c0252-a269-4296-8af3-d235b3c78efc"),
    ).resolves.toBeNull();
  });
});