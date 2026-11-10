import { describe, expect, it } from "vitest";
import { operationCostEditPath } from "@/lib/utils/operation-cost-routes";

describe("operationCostEditPath", () => {
  it("aponta para a rota de edição do custo", () => {
    const opId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
    const costId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
    expect(operationCostEditPath(opId, costId)).toBe(
      `/operations/${opId}/costs/${costId}/edit`,
    );
  });
});
