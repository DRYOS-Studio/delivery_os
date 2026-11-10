import { describe, expect, it } from "vitest";
import { formatDateBR } from "@/lib/utils/date";

describe("formatDateBR", () => {
  it("datas calendário batem com input type=date (sem off-by-one UTC)", () => {
    expect(formatDateBR("2026-10-26")).toBe("26/10/2026");
    expect(formatDateBR("2026-10-25")).toBe("25/10/2026");
  });
});
