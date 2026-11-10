import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/db/types";
import { generateClientChargesFromContract } from "@/lib/db/queries/client-charges";

const CONTRACT_ID = "8e79c305-1629-4f82-8dbe-6ce9cbde1369";
const CLIENT_ID = "9af2985d-10c2-4301-99d2-8100e1b36541";

const contractRow = {
  id: CONTRACT_ID,
  client_id: CLIENT_ID,
  status: "vigente",
  monthly_value: 1000,
  implementation_fee: 0,
  implementation_fee_paid: false,
  first_billing_date: "2026-10-26",
  start_date: "2026-10-25",
  end_date: "2027-04-24",
  payment_day_of_month: 26,
};

type SlotRow = {
  id: string;
  client_id: string;
  client_contract_id: string;
  charge_type: string;
  competence: string;
  status: string;
};

function chargeGenSupabase(slots: SlotRow[]) {
  let nextId = 1;
  const client = {
    from(table: string) {
      if (table === "client_contracts") {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({ data: contractRow, error: null }),
            }),
          }),
        };
      }
      if (table === "operations") {
        return {
          select: () => ({
            eq: () => ({
              is: () => ({
                in: () => ({
                  order: () => ({
                    limit: () => ({
                      maybeSingle: async () => ({
                        data: { id: "op-1" },
                        error: null,
                      }),
                    }),
                  }),
                }),
              }),
            }),
          }),
        };
      }
      if (table === "client_charges") {
        const matchFilters = (filters: [string, string][]) =>
          slots.filter((r) =>
            filters.every(
              ([col, val]) => (r as Record<string, string>)[col] === val,
            ),
          );
        const queryBuilder = (filters: [string, string][]) => ({
          eq: (col: string, val: string) =>
            queryBuilder([...filters, [col, val]]),
          maybeSingle: async () => {
            const hits = matchFilters(filters);
            return { data: hits[0] ?? null, error: null };
          },
          order: () => ({
            limit: () =>
              Promise.resolve({ data: matchFilters(filters), error: null }),
          }),
          then: (
            resolve: (v: { data: SlotRow[]; error: null }) => void,
            reject?: (e: unknown) => void,
          ) =>
            Promise.resolve({ data: matchFilters(filters), error: null }).then(
              resolve,
              reject,
            ),
        });
        return {
          select: () => queryBuilder([]),
          insert: (row: Record<string, unknown>) => ({
            select: () => ({
              maybeSingle: async () => {
                const id = `new-${nextId++}`;
                slots.push({
                  id,
                  client_id: row.client_id as string,
                  client_contract_id: row.client_contract_id as string,
                  charge_type: row.charge_type as string,
                  competence: row.competence as string,
                  status: (row.status as string) ?? "prevista",
                });
                return { data: { id }, error: null };
              },
            }),
          }),
          delete: () => ({
            eq: async (_col: string, id: string) => {
              const idx = slots.findIndex((s) => s.id === id);
              if (idx >= 0) slots.splice(idx, 1);
              return { error: null };
            },
          }),
        };
      }
      throw new Error(`unexpected table ${table}`);
    },
  } as unknown as SupabaseClient<Database>;
  return client;
}

describe("generateClientChargesFromContract dedup", () => {
  it("pula apenas cobranças ativas já existentes", async () => {
    const slots: SlotRow[] = [
      {
        id: "existing-1",
        client_id: CLIENT_ID,
        client_contract_id: CONTRACT_ID,
        charge_type: "mensalidade",
        competence: "2026-10-01",
        status: "prevista",
      },
    ];
    const supabase = chargeGenSupabase(slots);
    const r = await generateClientChargesFromContract(CONTRACT_ID, 6, supabase);
    expect(r.skipped).toBe(1);
    expect(r.inserted).toBe(5);
    expect(slots).toHaveLength(6);
  });

  it("substitui cobrança cancelada e insere de novo", async () => {
    const slots: SlotRow[] = [
      {
        id: "cancelled-1",
        client_id: CLIENT_ID,
        client_contract_id: CONTRACT_ID,
        charge_type: "mensalidade",
        competence: "2026-10-01",
        status: "cancelada",
      },
    ];
    const supabase = chargeGenSupabase(slots);
    const r = await generateClientChargesFromContract(CONTRACT_ID, 6, supabase);
    expect(r.skipped).toBe(0);
    expect(r.inserted).toBe(6);
    expect(
      slots.some((s) => s.competence === "2026-10-01" && s.status !== "cancelada"),
    ).toBe(true);
  });
});
