import { describe, expect, it } from "vitest";
import { isActiveStatus } from "@/lib/utils/operation-status";
import type { OperationStatus } from "@/lib/utils/operation-status";

describe("isActiveStatus", () => {
  it("não lança para status desconhecido no runtime", () => {
    expect(isActiveStatus("em_operacao" as OperationStatus)).toBe(true);
    expect(
      isActiveStatus("status_inexistente_xyz" as OperationStatus),
    ).toBe(false);
  });
});