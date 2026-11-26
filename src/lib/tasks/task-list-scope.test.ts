import { describe, expect, it } from "vitest";
import type { TaskScopeFilterOptions } from "@/lib/db/queries/task-scope-filters";
import {
  parseTaskListScopeParams,
  resolveTaskListScope,
} from "@/lib/tasks/task-list-scope";

const OPTIONS: TaskScopeFilterOptions = {
  clients: [
    { id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", name: "Cliente A" },
    { id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", name: "Cliente B" },
  ],
  operations: [
    {
      id: "11111111-1111-4111-8111-111111111111",
      name: "Op A1",
      clientId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    },
    {
      id: "22222222-2222-4222-8222-222222222222",
      name: "Op B1",
      clientId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    },
  ],
  frentes: [
    {
      id: "33333333-3333-4333-8333-333333333333",
      name: "Frente A1",
      operationId: "11111111-1111-4111-8111-111111111111",
    },
  ],
};

describe("parseTaskListScopeParams", () => {
  it("ignora uuid inválido e chaves repetidas (primeiro valor)", () => {
    expect(
      parseTaskListScopeParams({
        client_id: ["not-a-uuid", "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"],
        operation_id: "nope",
      }),
    ).toEqual({
      clientId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    });
  });

  it("aceita os três ids válidos", () => {
    expect(
      parseTaskListScopeParams({
        client_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        operation_id: "11111111-1111-4111-8111-111111111111",
        frente_id: "33333333-3333-4333-8333-333333333333",
      }),
    ).toEqual({
      clientId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      operationId: "11111111-1111-4111-8111-111111111111",
      frenteId: "33333333-3333-4333-8333-333333333333",
    });
  });
});

describe("resolveTaskListScope", () => {
  it("infere cliente e operação a partir da frente", () => {
    expect(
      resolveTaskListScope(
        { frenteId: "33333333-3333-4333-8333-333333333333" },
        OPTIONS,
      ),
    ).toEqual({
      clientId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      operationId: "11111111-1111-4111-8111-111111111111",
      frenteId: "33333333-3333-4333-8333-333333333333",
    });
  });

  it("descarta operação de outro cliente quando cliente está fixo", () => {
    expect(
      resolveTaskListScope(
        {
          clientId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
          operationId: "22222222-2222-4222-8222-222222222222",
        },
        OPTIONS,
      ),
    ).toEqual({
      clientId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    });
  });

  it("zera escopo desconhecido", () => {
    expect(
      resolveTaskListScope(
        { clientId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc" },
        OPTIONS,
      ),
    ).toEqual({});
  });
});