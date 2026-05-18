# salary-based-costs Specification

## Problem Statement

Modelo atual de custo derivado de alocação exige preencher taxa horária (R$/h) por pessoa e % de capacidade por allocation. Usuário pensa em outros termos:
- **Salário mensal** da pessoa (R$/mês)
- **Horas contratadas** por semana (40h/sem)
- **Horas alocadas** em cada Frente (16h/sem)

E quer o sistema derivar o resto sozinho.

## Goals

- [ ] Coluna `persons.monthly_compensation numeric(12,2)` nullable
- [ ] Coluna `persons.contracted_weekly_hours numeric(5,2)` nullable
- [ ] Coluna `allocations.weekly_hours numeric(5,2)` nullable
- [ ] Manter colunas legadas (`hourly_rate`, `capacity_weekly_pct`) nullable — sem migration destrutiva
- [ ] Cálculo de custo prioriza novos campos com fallback nos antigos
- [ ] PersonForm: campos "Salário mensal" + "Horas contratadas/semana" + hint mostrando rate derivado
- [ ] AllocationForm: campo "Horas/semana alocadas" como input principal (capacity_weekly_pct passa a ser readonly/legacy)
- [ ] CostsTab: coluna "h/sem" no lugar de "%"
- [ ] DATABASE_SCHEMA.md atualizado

## Out of Scope

- Audit log de salário
- Histórico de salário
- Salário diferenciado por papel ou Frente
- Validação de overcommit (somatório de alocações > contracted hours) — só warning visual no MVP
- Remover capacity_weekly_pct (data legada existe em fixtures)
- Conversão de moeda
- Câmbio
- Custos de impostos / encargos sobre o salário

## User Stories

### P1 — Schema ⭐ MVP
1. Migration ALTER TABLE persons + allocations com 3 colunas nullable
2. Sem CHECK adicional (valores opcionais, qualquer >= 0 vale)
3. Comments em colunas explicando uso

### P1 — Cálculo ⭐ MVP
Atualizar `getOperationMonthlyCosts` com função `deriveMonthlyCost(person, allocation)`:

```
const compensation = person.monthly_compensation;
const contracted = person.contracted_weekly_hours;
const allocHours = allocation.weekly_hours;

// Modo 1: novo (salary + hours)
if (compensation != null && contracted != null && contracted > 0) {
  const rate = compensation / (contracted * 4);
  const monthHours = allocHours != null
    ? allocHours * 4
    : (allocation.capacity_weekly_pct / 100) * contracted * 4;
  return rate * monthHours;
}

// Modo 2: legacy (hourly_rate + capacity_pct)
if (person.hourly_rate != null) {
  const monthHours = allocHours != null
    ? allocHours * 4
    : (allocation.capacity_weekly_pct / 100) * 160;
  return person.hourly_rate * monthHours;
}

return 0;
```

### P1 — UI ⭐ MVP
1. PersonForm:
   - Adicionar campo "Salário mensal" (R$, similar ao MRR)
   - Adicionar campo "Horas contratadas/semana" (number, default placeholder 40)
   - Hint readonly abaixo do salário: "Taxa derivada: R$ X,XX/h" (calculado client-side)
   - Manter campo `hourly_rate` visível (admin only) com hint "ou preencha salário+horas acima pra derivar"
2. AllocationForm:
   - Adicionar campo "Horas/semana alocadas" (número, ex: 16)
   - capacity_weekly_pct vira readonly+legacy ou hidden no MVP (esconde se weekly_hours preenchido)
3. CostsTab:
   - Coluna "h/sem" mostrando horas/sem (derivadas ou diretas)
   - Manter % como tooltip ou secundário

## Edge Cases
- Pessoa com tudo null → custo 0
- Pessoa só com hourly_rate (legacy) → usa modo 2
- Pessoa só com monthly_compensation mas sem contracted_weekly_hours → custo 0 (não dá pra derivar)
- Allocation com weekly_hours preenchido → usa direto
- Allocation com só capacity_pct → derivado via contracted (se preenchido) ou 40 default
- Salário negativo → CHECK ou Zod >= 0

## Success Criteria
- [ ] Migration aplica
- [ ] PersonForm permite preencher salário+horas; rate derivado aparece como hint
- [ ] AllocationForm permite preencher horas/sem
- [ ] CostsTab mostra horas alocadas e custo mensal correto
- [ ] Cálculo respeita prioridade (novos > legacy)
- [ ] DATABASE_SCHEMA.md atualizado
- [ ] Smoke admin

## Decisões
| Questão | Decisão | Razão |
|---|---|---|
| Substituir vs coexistir | Coexistir | Dados legados; sem migration destrutiva |
| `hourly_rate` visível no form | Sim, secundário | Permite override manual; documenta legacy |
| Default contracted_weekly_hours | Sem default no banco; placeholder 40 no form | Não pré-popular dados existentes |
| Validar somatório alocações | Não MVP | Só warning futuro |
| Mostrar % no CostsTab | Não no MVP | Pode reaparecer se demanda |
| Impostos/encargos | Não | Salário cru |
