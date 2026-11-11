import { describe, expect, it } from "vitest";
import { isPostgrestMissingColumnError } from "@/lib/db/postgrest-schema";

describe("isPostgrestMissingColumnError", () => {
  it("reconhece PGRST204 e coluna inexistente", () => {
    expect(
      isPostgrestMissingColumnError({
        code: "PGRST204",
        message:
          "Could not find the 'auto_create_tasks_from_next_steps' column of 'meetings' in the schema cache",
      }),
    ).toBe(true);
    expect(
      isPostgrestMissingColumnError({
        code: "42703",
        message: 'column "frente_id" does not exist',
      }),
    ).toBe(true);
  });

  it("ignora outros erros", () => {
    expect(
      isPostgrestMissingColumnError({
        code: "23503",
        message: "foreign key violation",
      }),
    ).toBe(false);
  });
});
