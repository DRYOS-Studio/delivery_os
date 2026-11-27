import { describe, expect, it } from "vitest";
import {
  isMissingCatalogGroupColumnError,
  selectWithoutCatalogGroup,
  withCatalogGroupSelectFallback,
} from "@/lib/db/queries/operation-catalog-fallback";

describe("operation-catalog-fallback", () => {
  it("detecta coluna catalog_group ausente no PostgREST", () => {
    expect(
      isMissingCatalogGroupColumnError(
        "column operations.catalog_group does not exist",
      ),
    ).toBe(true);
    expect(
      isMissingCatalogGroupColumnError(
        "Could not find the 'catalog_group' column of 'operations' in the schema cache",
      ),
    ).toBe(true);
    expect(isMissingCatalogGroupColumnError("permission denied")).toBe(false);
  });

  it("remove catalog_group do select", () => {
    const raw = "id, name, catalog_group, product_line, status";
    expect(selectWithoutCatalogGroup(raw)).toBe(
      "id, name, product_line, status",
    );
  });

  it("refaz query com select legado quando catalog_group falha", async () => {
    const calls: string[] = [];
    const res = await withCatalogGroupSelectFallback(
      "id, catalog_group, product_line",
      async (select) => {
        calls.push(select);
        if (select.includes("catalog_group")) {
          return {
            error: { message: "column operations.catalog_group does not exist" },
            data: null,
          };
        }
        return { error: null, data: [{ id: "1", product_line: "core" }] };
      },
    );
    expect(calls).toHaveLength(2);
    expect(res.error).toBeNull();
    expect(res.data).toHaveLength(1);
  });
});