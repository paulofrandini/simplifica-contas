/** @param {number[]} values */
function total(values) {
  return values.reduce((sum, value) => sum + Math.round(Number(value) || 0), 0);
}

/**
 * @typedef {{ amountCents: number, paid: boolean }} FinanceItem
 */

/**
 * Calcula o resumo financeiro exclusivamente em centavos.
 * Cada saída pertence a uma única categoria para impedir dupla contagem.
 * @param {{
 *   incomes?: FinanceItem[],
 *   expenses?: FinanceItem[],
 *   directBills?: FinanceItem[],
 *   cardInvoices?: FinanceItem[],
 *   creditInstallments?: FinanceItem[]
 * }} entries
 */
export function calculateFinanceSummary(entries) {
  const {
    incomes = [],
    expenses = [],
    directBills = [],
    cardInvoices = [],
    creditInstallments = [],
  } = entries;
  const income = total(incomes.map((item) => item.amountCents));
  const receivedIncome = total(incomes.filter((item) => item.paid).map((item) => item.amountCents));
  const incidental = total(expenses.map((item) => item.amountCents));
  const bills = total(directBills.map((item) => item.amountCents));
  const cards = total(cardInvoices.map((item) => item.amountCents));
  const credit = total(creditInstallments.map((item) => item.amountCents));
  const committed = incidental + bills + cards + credit;
  const paidExpenses = total(expenses.filter((item) => item.paid).map((item) => item.amountCents));
  const paidBills = total(directBills.filter((item) => item.paid).map((item) => item.amountCents));
  const paidCards = total(cardInvoices.filter((item) => item.paid).map((item) => item.amountCents));
  const paidCredit = total(creditInstallments.filter((item) => item.paid).map((item) => item.amountCents));
  const realizedOutflows = paidExpenses + paidBills + paidCards + paidCredit;

  return {
    income,
    receivedIncome,
    incidental,
    bills,
    cards,
    credit,
    committed,
    paidExpenses,
    paidBills,
    paidCards,
    paidCredit,
    realizedOutflows,
    availableForecast: income - committed,
    availableRealized: receivedIncome - realizedOutflows,
  };
}
