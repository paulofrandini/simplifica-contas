import assert from "node:assert/strict";
import test from "node:test";

import { calculateFinanceSummary } from "../lib/finance-summary.mjs";

test("separa previsto e realizado sem dupla contagem", () => {
  const summary = calculateFinanceSummary({
    incomes: [{ amountCents: 10_000_00, paid: true }, { amountCents: 500_00, paid: false }],
    expenses: [{ amountCents: 250_00, paid: true }, { amountCents: 100_00, paid: false }],
    directBills: [{ amountCents: 1_000_00, paid: true }],
    cardInvoices: [{ amountCents: 2_000_00, paid: false }],
    creditInstallments: [{ amountCents: 300_00, paid: true }],
  });

  assert.equal(summary.income, 10_500_00);
  assert.equal(summary.committed, 3_650_00);
  assert.equal(summary.availableForecast, 6_850_00);
  assert.equal(summary.realizedOutflows, 1_550_00);
  assert.equal(summary.availableRealized, 8_450_00);
});

test("mantém valores negativos quando os compromissos passam da renda", () => {
  const summary = calculateFinanceSummary({
    incomes: [{ amountCents: 1_000_00, paid: false }],
    cardInvoices: [{ amountCents: 1_200_00, paid: false }],
  });

  assert.equal(summary.availableForecast, -200_00);
  assert.equal(summary.availableRealized, 0);
});
