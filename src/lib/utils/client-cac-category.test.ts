import { describe, expect, it } from "vitest";
import {
  CLIENT_CAC_CATEGORIES,
  clientCacCategoryLabel,
} from "@/lib/utils/client-cac-category";

describe("client CAC categories", () => {
  it("covers all enum values with labels", () => {
    for (const c of CLIENT_CAC_CATEGORIES) {
      expect(clientCacCategoryLabel(c).length).toBeGreaterThan(2);
    }
    expect(CLIENT_CAC_CATEGORIES).toHaveLength(5);
  });
});
