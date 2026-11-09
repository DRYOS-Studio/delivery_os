import { describe, expect, it } from "vitest";
import type { ActivityEventRow } from "@/lib/db/queries/activity";
import {
  formatActivityActorLabel,
  formatActivitySentence,
  type ActivityFormatContext,
} from "@/lib/utils/activity-format";

const ctx: ActivityFormatContext = {
  persons: {
    "fec8083a-597b-4a17-b3f8-637568d848ed": "Jonathan",
  },
  frentes: {
    "cea77e8d-1111-4222-8333-444444444444": "CRM walkthrough",
  },
  operations: {},
  clients: {},
  areas: {},
  profileNames: {
    "11111111-1111-4111-8111-111111111111": "Rafael",
  },
};

function row(partial: Partial<ActivityEventRow>): ActivityEventRow {
  return {
    id: "evt-1",
    createdAt: "2026-11-07T17:57:00.000Z",
    action: "created",
    fieldKey: null,
    oldValue: null,
    newValue: null,
    actorName: "Rafael",
    actorProfileId: "11111111-1111-4111-8111-111111111111",
    subjectType: "task",
    subjectId: "task-1",
    metadata: {},
    ...partial,
  };
}

describe("formatActivitySentence", () => {
  it("formata criação de tarefa com frente", () => {
    const sentence = formatActivitySentence(
      row({
        action: "created",
        newValue: {
          title: "Preparar walkthrough do CRM para reuniao 09/11 12h",
          status: "todo",
          frente_id: "cea77e8d-1111-4222-8333-444444444444",
          operation_id: "554de188-2222-4222-8333-444444444444",
        },
      }),
      ctx,
    );
    expect(sentence).toBe(
      'Rafael criou a tarefa “Preparar walkthrough do CRM para reuniao 09/11 12h” na frente CRM walkthrough',
    );
  });

  it("formata assignee_added com nome resolvido", () => {
    const sentence = formatActivitySentence(
      row({
        action: "assignee_added",
        fieldKey: "assignees",
        newValue: "fec8083a-597b-4a17-b3f8-637568d848ed",
      }),
      ctx,
    );
    expect(sentence).toBe("Rafael atribuiu a tarefa a Jonathan");
  });

  it("formata mudança de status da tarefa", () => {
    const sentence = formatActivitySentence(
      row({
        action: "updated",
        fieldKey: "status",
        oldValue: "todo",
        newValue: "doing",
      }),
      ctx,
    );
    expect(sentence).toBe(
      "Rafael alterou o status da tarefa de A fazer para Em andamento",
    );
  });

  it("degrada UUID desconhecido", () => {
    const sentence = formatActivitySentence(
      row({
        action: "assignee_added",
        fieldKey: "assignees",
        newValue: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      }),
      ctx,
    );
    expect(sentence).toBe("Rafael atribuiu a tarefa a (item removido)");
  });
});

describe("formatActivityActorLabel", () => {
  it("usa metadata mcp quando nome do perfil não veio no join", () => {
    const label = formatActivityActorLabel(
      row({
        actorName: null,
        actorProfileId: "22222222-2222-4222-8222-222222222222",
        metadata: { source: "mcp" },
      }),
      ctx,
    );
    expect(label).toBe("Agente MCP");
  });

  it("mostra Colega quando perfil existe mas nome está oculto por RLS", () => {
    const label = formatActivityActorLabel(
      row({
        actorName: null,
        actorProfileId: "33333333-3333-4333-8333-333333333333",
        metadata: {},
      }),
      ctx,
    );
    expect(label).toBe("Colega");
  });
});
