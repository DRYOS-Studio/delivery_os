import { describe, expect, it } from "vitest";
import { clientSchema } from "@/lib/validators/client";
import { clientContractFormSchema } from "@/lib/validators/client-contract";
import { frenteSchema } from "@/lib/validators/frente";
import { operationSchema } from "@/lib/validators/operation";

/**
 * Caso Assis Sat (validação de modelo — sem persistir produção):
 * DRYOS OS Basic R$397/m, implantação R$1000, onboarding 2026-11-04,
 * 1ª cobrança dia 14, contato Vinicius, aceite WhatsApp em notes.
 */
describe("Assis Sat field mapping (validators only)", () => {
  it("maps commercial facts to existing fields without invented finance columns", () => {
    const client = clientSchema.safeParse({
      name: "Assis Sat",
      slug: "assis-sat",
      primary_contact_name: "Vinicius Assis",
      notes:
        "Motivos de perda: equipe cliente. API OpenAI+WhatsApp pendente; acesso Isabelle aguarda e-mail.",
    });
    expect(client.success).toBe(true);

    const contract = clientContractFormSchema.safeParse({
      label: "DRYOS OS Basic — aceite WhatsApp",
      monthly_value: "397",
      implementation_fee: "1000",
      currency: "BRL",
      start_date: "2026-11-04",
      first_billing_date: "2026-12-14",
      payment_day_of_month: "14",
      implementation_fee_paid: true,
      status: "vigente",
      notes: "Aceite por WhatsApp, sem assinatura formal.",
    });
    expect(contract.success).toBe(true);

    const operation = operationSchema.safeParse({
      client_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      product_line: "core",
      name: "Assis Sat — DRYOS OS Basic",
      status: "em_construcao",
      recurrence: "mensal",
      monthly_recurring_revenue: 397,
      start_date: "2026-11-04",
    });
    expect(operation.success).toBe(true);

    const frente = frenteSchema.safeParse({
      name: "DRYOS OS Basic — implantação",
      cycle_type: "c",
      domain: "infra",
      phase: "execucao",
      actionable_status: "aguardando configuração de mensagens recebidas até 09/11",
      start_date: "2026-11-04",
      product_id: undefined,
    });
    expect(frente.success).toBe(true);
  });
});
