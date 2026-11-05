import { and, desc, eq, gte, lt } from "drizzle-orm";

import { getDb } from "@/db";
import {
  bills, cardInvoices, cardPurchases, creditCards, investments, loanInstallments, profiles, transactions,
} from "@/db/schema";
import { calculateFinanceSummary } from "@/lib/finance-summary.mjs";
import { getSimplificaUser } from "@/lib/auth-user";

type FinanceAction =
  | "add_transaction" | "update_transaction" | "toggle_transaction" | "delete_transaction"
  | "add_bill" | "update_bill" | "toggle_bill" | "delete_bill"
  | "add_card" | "update_card" | "delete_card" | "update_card_invoice" | "toggle_card_invoice"
  | "add_card_purchase" | "update_card_purchase" | "delete_card_purchase"
  | "add_loan" | "toggle_loan" | "delete_loan"
  | "add_investment" | "update_investment" | "delete_investment";

function errorMessage(error: unknown) {
  const message = error instanceof Error ? error.message : "Erro inesperado";
  if (message.includes("no such table") || message.includes("no such column")) {
    return "O armazenamento financeiro está sendo atualizado. Tente novamente em instantes.";
  }
  return message;
}

function asMoneyCents(value: unknown) {
  let raw = String(value ?? "0").trim().replace(/R\$/gi, "").replace(/\s/g, "");
  if (raw.includes(",") && raw.includes(".")) {
    raw = raw.lastIndexOf(",") > raw.lastIndexOf(".") ? raw.replace(/\./g, "").replace(",", ".") : raw.replace(/,/g, "");
  } else if (raw.includes(",")) {
    raw = raw.replace(/\./g, "").replace(",", ".");
  } else if (raw.includes(".") && !/^\d+\.\d{1,2}$/.test(raw)) {
    raw = raw.replace(/\./g, "");
  }
  const number = Number(raw);
  return Number.isFinite(number) ? Math.round(number * 100) : 0;
}

function validMonth(value: string | null) {
  return value && /^\d{4}-(0[1-9]|1[0-2])$/.test(value) ? value : new Date().toISOString().slice(0, 7);
}

function addMonths(month: string, amount: number) {
  const [year, monthNumber] = month.split("-").map(Number);
  return new Date(Date.UTC(year, monthNumber - 1 + amount, 1)).toISOString().slice(0, 7);
}

function monthDiff(start: string, end: string) {
  const [startYear, startMonth] = start.split("-").map(Number);
  const [endYear, endMonth] = end.split("-").map(Number);
  return (endYear - startYear) * 12 + endMonth - startMonth;
}

function monthBounds(month: string) {
  return { start: month + "-01T00:00:00.000Z", end: addMonths(month, 1) + "-01T00:00:00.000Z" };
}

function repeatCount(value: unknown, allowed: number[]) {
  const count = Number(value);
  return allowed.includes(count) ? count : allowed[0];
}

function activePurchase<T extends { firstPaymentMonth: string; installmentCount: number; totalCents: number }>(purchase: T, month: string) {
  const index = monthDiff(purchase.firstPaymentMonth, month);
  if (index < 0 || index >= purchase.installmentCount) return null;
  return {
    installmentNumber: index + 1,
    remainingInstallments: purchase.installmentCount - index,
    amountCents: Math.round(purchase.totalCents / purchase.installmentCount),
  };
}

function normalizedTitle(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

function billIdentity(title: string, selectedCategory?: string) {
  const name = normalizedTitle(title);
  const matches = (words: string[]) => words.some((word) => name.includes(word));
  let category = selectedCategory && selectedCategory !== "Automático" ? selectedCategory : "Outros";
  let icon = "receipt";

  if (matches(["aluguel", "condominio", "casa", "iptu"])) { category = "Moradia"; icon = "home"; }
  else if (matches(["agua", "sanepar"])) { category = "Casa"; icon = "water"; }
  else if (matches(["luz", "energia", "copel"])) { category = "Casa"; icon = "energy"; }
  else if (matches(["internet", "wifi"])) { category = "Conectividade"; icon = "wifi"; }
  else if (matches(["celular", "telefone", "tim", "claro", "vivo"])) { category = "Conectividade"; icon = "phone"; }
  else if (matches(["netflix", "streaming", "spotify", "prime", "disney", "globoplay"])) { category = "Assinaturas"; icon = "streaming"; }
  else if (matches(["google one", "icloud", "nuvem"])) { category = "Assinaturas"; icon = "cloud"; }
  else if (matches(["dogs", "pet", "veterin"])) { category = "Pets"; icon = "pet"; }
  else if (matches(["academia", "gym"])) { category = "Saúde"; icon = "fitness"; }
  else if (matches(["carro", "combustivel", "gasolina", "uber"])) { category = "Transporte"; icon = matches(["combustivel", "gasolina"]) ? "fuel" : "car"; }
  else if (matches(["estacionamento"])) { category = "Transporte"; icon = "parking"; }
  else if (matches(["facul", "escola", "curso", "mensalidade"])) { category = "Educação"; icon = "education"; }
  else if (matches(["imposto", "mei", "das"])) { category = "Impostos"; icon = "tax"; }
  else if (matches(["contabil", "contador"])) { category = "Trabalho"; icon = "accounting"; }
  else if (matches(["adobe", "software"])) { category = "Trabalho"; icon = "design"; }
  else if (matches(["diarista", "faxina", "limpeza"])) { category = "Serviços"; icon = "cleaning"; }
  else if (category === "Casa" || category === "Moradia") icon = "home";
  else if (category === "Conectividade") icon = "wifi";
  else if (category === "Assinaturas") icon = "streaming";
  else if (category === "Transporte") icon = "car";
  else if (category === "Educação") icon = "education";
  else if (category === "Saúde") icon = "fitness";
  else if (category === "Pets") icon = "pet";
  else if (category === "Trabalho") icon = "accounting";
  else if (category === "Impostos") icon = "tax";
  else if (category === "Serviços") icon = "cleaning";
  return { category, icon };
}

async function currentUser() {
  return getSimplificaUser();
}

export async function GET(request: Request) {
  const user = await currentUser();
  if (!user) return Response.json({ error: "Faça login para continuar." }, { status: 401 });

  try {
    const month = validMonth(new URL(request.url).searchParams.get("month"));
    const bounds = monthBounds(month);
    const historyStart = addMonths(month, -5);
    const historyBounds = monthBounds(historyStart);
    const historyEnd = addMonths(month, 1);
    const db = getDb();
    await db.insert(profiles).values({
      id: user.id,
      email: user.email,
      displayName: user.displayName,
    }).onConflictDoUpdate({
      target: profiles.id,
      set: { email: user.email, displayName: user.displayName },
    });
    const profileRows = await db.select().from(profiles).where(eq(profiles.id, user.id)).limit(1);
    if (profileRows[0] && profileRows[0].incomeConfirmationVersion < 1) {
      await db.update(transactions).set({ paid: false }).where(and(eq(transactions.userId, user.id), eq(transactions.type, "income")));
      await db.update(profiles).set({ incomeConfirmationVersion: 1 }).where(eq(profiles.id, user.id));
    }
    if (profileRows[0] && profileRows[0].cardWorkflowVersion < 1) {
      const currentCalendarMonth = new Date().toISOString().slice(0, 7);
      await db.update(bills).set({ cardTransferMode: "confirm", cardTransferred: false, paid: false }).where(and(eq(bills.userId, user.id), eq(bills.paymentMethod, "card"), gte(bills.billingMonth, currentCalendarMonth)));
      await db.update(profiles).set({ cardWorkflowVersion: 1 }).where(eq(profiles.id, user.id));
    }
    // Consultas sequenciais evitam pipelining no pool transacional do Supabase.
    const transactionRows = await db.select().from(transactions).where(and(eq(transactions.userId, user.id), gte(transactions.transactionDate, bounds.start), lt(transactions.transactionDate, bounds.end))).orderBy(desc(transactions.transactionDate), desc(transactions.id)).limit(250);
    const billRows = await db.select().from(bills).where(and(eq(bills.userId, user.id), eq(bills.billingMonth, month))).orderBy(bills.paid, bills.dueDay, bills.id).limit(100);
    const cardRows = await db.select().from(creditCards).where(eq(creditCards.userId, user.id)).orderBy(desc(creditCards.id)).limit(20);
    const invoiceRows = await db.select().from(cardInvoices).where(and(eq(cardInvoices.userId, user.id), eq(cardInvoices.billingMonth, month))).limit(50);
    const purchaseRows = await db.select().from(cardPurchases).where(eq(cardPurchases.userId, user.id)).orderBy(desc(cardPurchases.id)).limit(1000);
    const loanRows = await db.select().from(loanInstallments).where(and(eq(loanInstallments.userId, user.id), eq(loanInstallments.billingMonth, month))).orderBy(loanInstallments.paid, loanInstallments.id).limit(100);
    const linkedBillRows = await db.select().from(bills).where(and(eq(bills.userId, user.id), eq(bills.billingMonth, month), eq(bills.paymentMethod, "card"), eq(bills.cardTransferred, true))).limit(250);
    const investmentRows = await db.select().from(investments).where(eq(investments.userId, user.id)).orderBy(desc(investments.amountCents), investments.institution).limit(100);
    const historyTransactions = await db.select().from(transactions).where(and(eq(transactions.userId, user.id), eq(transactions.type, "expense"), gte(transactions.transactionDate, historyBounds.start), lt(transactions.transactionDate, bounds.end))).limit(1000);
    const historyBills = await db.select().from(bills).where(and(eq(bills.userId, user.id), gte(bills.billingMonth, historyStart), lt(bills.billingMonth, historyEnd))).limit(1500);
    const historyInvoices = await db.select().from(cardInvoices).where(and(eq(cardInvoices.userId, user.id), gte(cardInvoices.billingMonth, historyStart), lt(cardInvoices.billingMonth, historyEnd))).limit(500);
    const historyLoans = await db.select().from(loanInstallments).where(and(eq(loanInstallments.userId, user.id), gte(loanInstallments.billingMonth, historyStart), lt(loanInstallments.billingMonth, historyEnd))).limit(1000);

    const cardById = new Map(cardRows.map((card) => [card.id, card]));
    const invoiceByCard = new Map(invoiceRows.map((invoice) => [invoice.cardId, invoice]));
    const purchasesFor = (cardId: number, targetMonth: string) => purchaseRows.flatMap((purchase) => {
      if (purchase.cardId !== cardId) return [];
      const active = activePurchase(purchase, targetMonth);
      return active ? [{
        id: purchase.id, title: purchase.title, total: purchase.totalCents / 100,
        installmentAmount: active.amountCents / 100, installmentCount: purchase.installmentCount,
        firstPaymentMonth: purchase.firstPaymentMonth, installmentNumber: active.installmentNumber,
        remainingInstallments: active.remainingInstallments, amount: active.amountCents / 100,
      }] : [];
    });
    const linkedBillsFor = (cardId: number, targetMonth: string, source = historyBills) => source.filter((bill) => (
      bill.cardId === cardId && bill.paymentMethod === "card" && bill.cardTransferred && bill.billingMonth === targetMonth
    ));

    const cards = cardRows.map((card) => {
      const invoice = invoiceByCard.get(card.id);
      const purchases = purchasesFor(card.id, month);
      const linkedBills = linkedBillRows.filter((bill) => bill.cardId === card.id);
      const linkedBillCents = linkedBills.reduce((sum, bill) => sum + bill.amountCents, 0);
      const calculatedCents = purchases.reduce((sum, purchase) => sum + Math.round(purchase.amount * 100), linkedBillCents);
      const manualInvoiceCents = invoice?.amountCents || 0;
      return {
        id: card.id, bank: card.name, dueDay: card.dueDay, managementMode: card.managementMode,
        invoice: (card.managementMode === "items" ? calculatedCents : manualInvoiceCents || linkedBillCents) / 100,
        manualInvoice: manualInvoiceCents / 100, estimatedFromBills: card.managementMode === "total" && manualInvoiceCents === 0 && linkedBillCents > 0,
        paid: invoice?.paid || false, invoiceMonth: month, purchases,
        linkedBills: linkedBills.map((bill) => ({ id: bill.id, title: bill.title, amount: bill.amountCents / 100, sourceMonth: bill.billingMonth })),
      };
    });

    const summaryCents = calculateFinanceSummary({
      incomes: transactionRows.filter((item) => item.type === "income"),
      expenses: transactionRows.filter((item) => item.type === "expense"),
      directBills: billRows.filter((item) => !(item.paymentMethod === "card" && item.cardTransferred)),
      cardInvoices: cards.map((card) => ({ amountCents: Math.round(card.invoice * 100), paid: card.paid })),
      creditInstallments: loanRows,
    });
    const summary = Object.fromEntries(Object.entries(summaryCents).map(([key, value]) => [key, value / 100]));

    const history = Array.from({ length: 6 }, (_, index) => {
      const historyMonth = addMonths(historyStart, index);
      const expenses = historyTransactions.filter((item) => item.transactionDate.slice(0, 7) === historyMonth).reduce((sum, item) => sum + item.amountCents, 0);
      const fixed = historyBills.filter((item) => item.billingMonth === historyMonth && !(item.paymentMethod === "card" && item.cardTransferred)).reduce((sum, item) => sum + item.amountCents, 0);
      const manualInvoices = historyInvoices.filter((item) => item.billingMonth === historyMonth && cardById.get(item.cardId)?.managementMode !== "items").reduce((sum, item) => sum + item.amountCents, 0);
      const linkedEstimates = cardRows.filter((card) => card.managementMode === "total" && !historyInvoices.some((invoice) => invoice.cardId === card.id && invoice.billingMonth === historyMonth && invoice.amountCents > 0)).reduce((sum, card) => sum + linkedBillsFor(card.id, historyMonth).reduce((billSum, bill) => billSum + bill.amountCents, 0), 0);
      const itemInvoices = cardRows.filter((card) => card.managementMode === "items").reduce((sum, card) => sum + purchasesFor(card.id, historyMonth).reduce((purchaseSum, purchase) => purchaseSum + Math.round(purchase.amount * 100), 0) + linkedBillsFor(card.id, historyMonth).reduce((billSum, bill) => billSum + bill.amountCents, 0), 0);
      const loans = historyLoans.filter((item) => item.billingMonth === historyMonth).reduce((sum, item) => sum + item.amountCents, 0);
      return { month: historyMonth, total: (expenses + fixed + manualInvoices + linkedEstimates + itemInvoices + loans) / 100 };
    });

    const payments = [
      ...transactionRows.map((item) => ({
        id: "transaction-" + item.id, sourceId: item.id, sourceType: "transaction", title: item.title,
        category: item.type === "income" ? (item.paid ? "Renda recebida" : "Renda prevista") : item.category + " · " + (item.paid ? "pago" : "pendente"),
        amount: item.amountCents / 100, type: item.type === "income" ? "income" : "payment",
        status: item.paid ? (item.type === "income" ? "received" : "paid") : "pending", date: item.transactionDate,
      })),
      ...billRows.map((item) => {
        const card = item.cardId ? cardById.get(item.cardId) : null;
        const invoicePaid = Boolean(item.cardId && invoiceByCard.get(item.cardId)?.paid);
        const status = item.paymentMethod === "card"
          ? (item.cardTransferred ? (invoicePaid ? "card_paid" : "card_linked") : "card_planned")
          : (item.paid ? "paid" : "pending");
        const category = item.paymentMethod === "card"
          ? (status === "card_paid" ? "Paga pela fatura " : status === "card_linked" ? "Incluída na fatura " : "Prevista no cartão ") + (card?.name || "")
          : "Conta mensal · " + (item.paid ? "paga" : "pendente");
        return {
        id: "bill-" + item.id, sourceId: item.id, sourceType: "bill", title: item.title,
          category, amount: item.amountCents / 100, type: "payment", status,
          date: month + "-" + String(item.dueDay).padStart(2, "0") + "T12:00:00.000Z",
        };
      }),
      ...cards.filter((card) => card.invoice > 0).map((card) => ({
        id: "card-" + card.id, sourceId: card.id, sourceType: "card", title: "Fatura " + card.bank,
        category: card.paid ? "Fatura paga" : "Fatura pendente", amount: card.invoice,
        type: "payment", status: card.paid ? "paid" : "pending",
        date: month + "-" + String(card.dueDay).padStart(2, "0") + "T12:00:00.000Z",
      })),
      ...loanRows.map((item) => ({
        id: "loan-" + item.id, sourceId: item.id, sourceType: "loan", title: item.title,
        category: (item.kind === "bank_limit" ? "Limite bancário" : "Empréstimo") + " · parcela " + item.installmentNumber + "/" + item.installmentCount,
        amount: item.amountCents / 100, type: "payment", status: item.paid ? "paid" : "pending", date: item.billingMonth + "-01T12:00:00.000Z",
      })),
    ].sort((a, b) => b.date.localeCompare(a.date));

    return Response.json({
      month,
      transactions: transactionRows.map((item) => ({
        id: item.id, title: item.title, category: item.category, amount: item.amountCents / 100,
        type: item.type, paid: item.paid, date: item.transactionDate, recurrenceId: item.recurrenceId,
      })),
      bills: billRows.map((item) => {
        const identity = billIdentity(item.title, item.category);
        const card = item.cardId ? cardById.get(item.cardId) : null;
        const cardInvoicePaid = Boolean(item.paymentMethod === "card" && item.cardId && invoiceByCard.get(item.cardId)?.paid);
        return {
          id: item.id, title: item.title, amount: item.amountCents / 100, dueDay: item.dueDay,
          paid: item.paymentMethod === "card" ? item.cardTransferred && cardInvoicePaid : item.paid,
          recurrenceId: item.recurrenceId, category: identity.category, icon: identity.icon, billingMonth: item.billingMonth,
          paymentMethod: item.paymentMethod, cardId: item.cardId, cardName: card?.name || null,
          cardTransferMode: item.cardTransferMode, cardTransferred: item.cardTransferred,
          cardInvoicePaid,
          paymentMonth: item.billingMonth,
          countsAsBill: !(item.paymentMethod === "card" && item.cardTransferred),
        };
      }),
      cards,
      loans: loanRows.map((item) => ({
        id: item.id, title: item.title, kind: item.kind, amount: item.amountCents / 100,
        billingMonth: item.billingMonth, installmentNumber: item.installmentNumber,
        installmentCount: item.installmentCount, paid: item.paid,
      })),
      investments: investmentRows.map((item) => ({ id: item.id, institution: item.institution, amount: item.amountCents / 100 })),
      investmentTotal: investmentRows.reduce((sum, item) => sum + item.amountCents, 0) / 100,
      payments,
      history,
      summary,
    });
  } catch (error) {
    return Response.json({ error: errorMessage(error) }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const user = await currentUser();
  if (!user) return Response.json({ error: "Faça login para continuar." }, { status: 401 });

  try {
    const payload = await request.json() as Record<string, unknown> & { action?: FinanceAction };
    const db = getDb();
    const action = payload.action;
    if (!action) return Response.json({ error: "Ação inválida." }, { status: 400 });
    await db.insert(profiles).values({
      id: user.id,
      email: user.email,
      displayName: user.displayName,
    }).onConflictDoUpdate({
      target: profiles.id,
      set: { email: user.email, displayName: user.displayName },
    });

    if (action === "add_transaction") {
      const title = String(payload.title || "").trim();
      const amountCents = asMoneyCents(payload.amount);
      const type: "income" | "expense" = payload.type === "income" ? "income" : "expense";
      const startMonth = validMonth(String(payload.month || ""));
      const count = type === "income" ? repeatCount(payload.repeatMonths, [1, 6, 12]) : 1;
      const day = Math.min(28, Math.max(1, Number(payload.day) || new Date().getUTCDate()));
      if (!title || amountCents <= 0) return Response.json({ error: "Informe uma descrição e um valor válido." }, { status: 400 });
      const recurrenceId = count > 1 ? crypto.randomUUID() : null;
      const rows = Array.from({ length: count }, (_, index) => {
        const targetMonth = addMonths(startMonth, index);
        return {
          userId: user.id, title, amountCents, type, paid: false,
          category: type === "income" ? "Renda" : String(payload.category || "Outros"),
          icon: type === "income" ? "income" : "food",
          transactionDate: targetMonth + "-" + String(day).padStart(2, "0") + "T12:00:00.000Z",
          recurrenceId,
        };
      });
      for (let index = 0; index < rows.length; index += 5) await db.insert(transactions).values(rows.slice(index, index + 5));
      return Response.json({ created: rows.length }, { status: 201 });
    }

    if (action === "update_transaction") {
      const id = Number(payload.id);
      const current = await db.select().from(transactions).where(and(eq(transactions.id, id), eq(transactions.userId, user.id))).limit(1);
      if (!current[0]) return Response.json({ error: "Movimentação não encontrada." }, { status: 404 });
      const title = String(payload.title || "").trim();
      const amountCents = asMoneyCents(payload.amount);
      const day = Math.min(28, Math.max(1, Number(payload.day) || 1));
      if (!title || amountCents <= 0) return Response.json({ error: "Informe uma descrição e um valor válido." }, { status: 400 });
      const category = current[0].type === "income" ? "Renda" : String(payload.category || current[0].category || "Outros");
      let targets = current;
      if (payload.scope === "future" && current[0].recurrenceId) {
        targets = await db.select().from(transactions).where(and(
          eq(transactions.userId, user.id),
          eq(transactions.recurrenceId, current[0].recurrenceId),
          gte(transactions.transactionDate, current[0].transactionDate.slice(0, 7) + "-01T00:00:00.000Z"),
        )).limit(24);
      }
      for (const target of targets) {
        await db.update(transactions).set({
          title, amountCents, category,
          transactionDate: target.transactionDate.slice(0, 8) + String(day).padStart(2, "0") + "T12:00:00.000Z",
        }).where(and(eq(transactions.id, target.id), eq(transactions.userId, user.id)));
      }
      return Response.json({ ok: true, updated: targets.length });
    }

    if (action === "toggle_transaction") {
      const id = Number(payload.id);
      const rows = await db.select().from(transactions).where(and(eq(transactions.id, id), eq(transactions.userId, user.id))).limit(1);
      if (!rows[0]) return Response.json({ error: "Movimentação não encontrada." }, { status: 404 });
      await db.update(transactions).set({ paid: !rows[0].paid }).where(and(eq(transactions.id, id), eq(transactions.userId, user.id)));
      return Response.json({ ok: true });
    }

    if (action === "add_bill") {
      const title = String(payload.title || "").trim();
      const amountCents = asMoneyCents(payload.amount);
      const startMonth = validMonth(String(payload.month || ""));
      const count = repeatCount(payload.repeatMonths, [1, 6, 12]);
      const dueDay = Math.min(28, Math.max(1, Number(payload.dueDay) || 1));
      const identity = billIdentity(title, String(payload.category || "Automático"));
      const paymentMethod: "direct" | "card" = payload.paymentMethod === "card" ? "card" : "direct";
      const cardId = paymentMethod === "card" ? Number(payload.cardId) : null;
      if (!title || amountCents <= 0) return Response.json({ error: "Informe a conta e um valor válido." }, { status: 400 });
      if (paymentMethod === "card") {
        const owned = await db.select().from(creditCards).where(and(eq(creditCards.id, Number(cardId)), eq(creditCards.userId, user.id))).limit(1);
        if (!owned[0]) return Response.json({ error: "Selecione um cartão válido." }, { status: 400 });
      }
      const recurrenceId = count > 1 ? crypto.randomUUID() : null;
      const rows = Array.from({ length: count }, (_, index) => ({
        userId: user.id, title, amountCents, dueLabel: "dia " + dueDay, dueDay,
        billingMonth: addMonths(startMonth, index), recurrenceId, category: identity.category, icon: identity.icon,
        paymentMethod, cardId, cardTransferMode: "confirm" as const, cardTransferred: false,
      }));
      for (let index = 0; index < rows.length; index += 5) await db.insert(bills).values(rows.slice(index, index + 5));
      return Response.json({ created: rows.length }, { status: 201 });
    }

    if (action === "update_bill") {
      const id = Number(payload.id);
      const current = await db.select().from(bills).where(and(eq(bills.id, id), eq(bills.userId, user.id))).limit(1);
      if (!current[0]) return Response.json({ error: "Conta não encontrada." }, { status: 404 });
      const title = String(payload.title || "").trim();
      const amountCents = asMoneyCents(payload.amount);
      const dueDay = Math.min(28, Math.max(1, Number(payload.dueDay) || 1));
      const identity = billIdentity(title, String(payload.category || "Automático"));
      const paymentMethod: "direct" | "card" = payload.paymentMethod === "card" ? "card" : "direct";
      const cardId = paymentMethod === "card" ? Number(payload.cardId) : null;
      if (!title || amountCents <= 0) return Response.json({ error: "Informe a conta e um valor válido." }, { status: 400 });
      if (paymentMethod === "card") {
        const owned = await db.select().from(creditCards).where(and(eq(creditCards.id, Number(cardId)), eq(creditCards.userId, user.id))).limit(1);
        if (!owned[0]) return Response.json({ error: "Selecione um cartão válido." }, { status: 400 });
      }
      const changes = {
        title, amountCents, dueDay, dueLabel: "dia " + dueDay, category: identity.category, icon: identity.icon,
        paymentMethod, cardId, cardTransferMode: "confirm" as const, cardTransferred: false,
        ...(paymentMethod === "card" ? { paid: false } : {}),
      };
      if (payload.scope === "future" && current[0].recurrenceId) {
        await db.update(bills).set(changes).where(and(eq(bills.userId, user.id), eq(bills.recurrenceId, current[0].recurrenceId), gte(bills.billingMonth, current[0].billingMonth)));
      } else {
        await db.update(bills).set(changes).where(and(eq(bills.id, id), eq(bills.userId, user.id)));
      }
      return Response.json({ ok: true });
    }

    if (action === "toggle_bill") {
      const id = Number(payload.id);
      const rows = await db.select().from(bills).where(and(eq(bills.id, id), eq(bills.userId, user.id))).limit(1);
      if (!rows[0]) return Response.json({ error: "Conta não encontrada." }, { status: 404 });
      if (rows[0].paymentMethod === "card" && rows[0].cardId) {
        const paymentMonth = rows[0].billingMonth;
        const invoice = await db.select().from(cardInvoices).where(and(eq(cardInvoices.cardId, rows[0].cardId), eq(cardInvoices.billingMonth, paymentMonth), eq(cardInvoices.userId, user.id))).limit(1);
        if (invoice[0]?.paid && payload.reopenInvoice !== true) return Response.json({ error: "Confirme a reabertura da fatura para alterar esta conta." }, { status: 409 });
        if (invoice[0]?.paid) await db.update(cardInvoices).set({ paid: false }).where(and(eq(cardInvoices.id, invoice[0].id), eq(cardInvoices.userId, user.id)));
        await db.update(bills).set({ cardTransferred: !rows[0].cardTransferred, paid: false }).where(and(eq(bills.id, id), eq(bills.userId, user.id)));
      } else {
        await db.update(bills).set({ paid: !rows[0].paid }).where(and(eq(bills.id, id), eq(bills.userId, user.id)));
      }
      return Response.json({ ok: true });
    }

    if (action === "add_card") {
      const bank = String(payload.bank || "").trim();
      const dueDay = Math.min(28, Math.max(1, Number(payload.dueDay) || 1));
      const managementMode = payload.managementMode === "items" ? "items" : "total";
      const invoiceCents = asMoneyCents(payload.invoice);
      const paymentMonth = validMonth(String(payload.paymentMonth || payload.month || ""));
      if (!bank || invoiceCents < 0) return Response.json({ error: "Informe o banco e um valor válido." }, { status: 400 });
      const [created] = await db.insert(creditCards).values({
        userId: user.id, name: bank, lastFour: "0000", brand: "BANCO",
        limitCents: 0, invoiceCents: 0, dueDay, managementMode,
      }).returning();
      if (managementMode === "total") {
        await db.insert(cardInvoices).values({ userId: user.id, cardId: created.id, billingMonth: paymentMonth, amountCents: invoiceCents });
      }
      return Response.json({ id: created.id, paymentMonth }, { status: 201 });
    }

    if (action === "update_card") {
      const bank = String(payload.bank || "").trim();
      const dueDay = Math.min(28, Math.max(1, Number(payload.dueDay) || 1));
      const managementMode = payload.managementMode === "items" ? "items" : "total";
      if (!bank) return Response.json({ error: "Informe o nome do banco." }, { status: 400 });
      await db.update(creditCards).set({ name: bank, dueDay, managementMode }).where(and(eq(creditCards.id, Number(payload.id)), eq(creditCards.userId, user.id)));
      return Response.json({ ok: true });
    }

    if (action === "update_card_invoice") {
      const invoiceCents = asMoneyCents(payload.invoice);
      const invoiceMonth = validMonth(String(payload.month || ""));
      const cardId = Number(payload.id);
      if (invoiceCents < 0) return Response.json({ error: "Informe um valor válido." }, { status: 400 });
      const owned = await db.select().from(creditCards).where(and(eq(creditCards.id, cardId), eq(creditCards.userId, user.id))).limit(1);
      if (!owned[0]) return Response.json({ error: "Cartão não encontrado." }, { status: 404 });
      await db.insert(cardInvoices).values({ userId: user.id, cardId, billingMonth: invoiceMonth, amountCents: invoiceCents }).onConflictDoUpdate({ target: [cardInvoices.cardId, cardInvoices.billingMonth], set: { amountCents: invoiceCents } });
      return Response.json({ ok: true });
    }

    if (action === "toggle_card_invoice") {
      const cardId = Number(payload.id);
      const invoiceMonth = validMonth(String(payload.month || ""));
      const owned = await db.select().from(creditCards).where(and(eq(creditCards.id, cardId), eq(creditCards.userId, user.id))).limit(1);
      if (!owned[0]) return Response.json({ error: "Cartão não encontrado." }, { status: 404 });
      const existing = await db.select().from(cardInvoices).where(and(eq(cardInvoices.cardId, cardId), eq(cardInvoices.billingMonth, invoiceMonth), eq(cardInvoices.userId, user.id))).limit(1);
      let amountCents = existing[0]?.amountCents || 0;
      if (owned[0].managementMode === "items") {
        const rows = await db.select().from(cardPurchases).where(and(eq(cardPurchases.cardId, cardId), eq(cardPurchases.userId, user.id))).limit(1000);
        amountCents = rows.reduce((sum, purchase) => sum + (activePurchase(purchase, invoiceMonth)?.amountCents || 0), 0);
      }
      const linkedRows = await db.select().from(bills).where(and(eq(bills.userId, user.id), eq(bills.cardId, cardId), eq(bills.paymentMethod, "card"), eq(bills.cardTransferred, true), eq(bills.billingMonth, invoiceMonth))).limit(250);
      const linkedCents = linkedRows.reduce((sum, bill) => sum + bill.amountCents, 0);
      if (owned[0].managementMode === "items" || amountCents <= 0) amountCents += linkedCents;
      if (amountCents <= 0) return Response.json({ error: "Cadastre um valor ou uma compra antes de marcar como paga." }, { status: 400 });
      const paid = !existing[0]?.paid;
      await db.insert(cardInvoices).values({ userId: user.id, cardId, billingMonth: invoiceMonth, amountCents, paid }).onConflictDoUpdate({ target: [cardInvoices.cardId, cardInvoices.billingMonth], set: { amountCents, paid } });
      return Response.json({ ok: true });
    }

    if (action === "add_card_purchase" || action === "update_card_purchase") {
      const title = String(payload.title || "").trim();
      const installmentCents = asMoneyCents(payload.installmentAmount);
      const installmentCount = Math.min(60, Math.max(1, Number(payload.installmentCount) || 1));
      const totalCents = installmentCents * installmentCount;
      const firstPaymentMonth = validMonth(String(payload.firstPaymentMonth || payload.month || ""));
      if (!title || installmentCents <= 0) return Response.json({ error: "Informe a compra e o valor de cada parcela." }, { status: 400 });
      if (action === "add_card_purchase") {
        const cardId = Number(payload.cardId);
        const owned = await db.select().from(creditCards).where(and(eq(creditCards.id, cardId), eq(creditCards.userId, user.id))).limit(1);
        if (!owned[0]) return Response.json({ error: "Cartão não encontrado." }, { status: 404 });
        await db.insert(cardPurchases).values({ userId: user.id, cardId, title, totalCents, installmentCount, firstPaymentMonth });
      } else {
        await db.update(cardPurchases).set({ title, totalCents, installmentCount, firstPaymentMonth }).where(and(eq(cardPurchases.id, Number(payload.id)), eq(cardPurchases.userId, user.id)));
      }
      return Response.json({ ok: true }, { status: action === "add_card_purchase" ? 201 : 200 });
    }

    if (action === "add_loan") {
      const title = String(payload.title || "").trim();
      const installmentCents = asMoneyCents(payload.installmentAmount);
      const installmentCount = Math.min(60, Math.max(1, Number(payload.installmentCount) || 1));
      const firstPaymentMonth = validMonth(String(payload.firstPaymentMonth || payload.month || ""));
      const kind: "loan" | "bank_limit" = payload.kind === "bank_limit" ? "bank_limit" : "loan";
      if (!title || installmentCents <= 0) return Response.json({ error: "Informe o crédito e o valor de cada parcela." }, { status: 400 });
      const recurrenceId = crypto.randomUUID();
      const rows = Array.from({ length: installmentCount }, (_, index) => ({
        userId: user.id, title, kind, amountCents: installmentCents,
        billingMonth: addMonths(firstPaymentMonth, index), installmentNumber: index + 1, installmentCount, recurrenceId,
      }));
      for (let index = 0; index < rows.length; index += 5) await db.insert(loanInstallments).values(rows.slice(index, index + 5));
      return Response.json({ created: rows.length }, { status: 201 });
    }

    if (action === "add_investment" || action === "update_investment") {
      const institution = String(payload.institution || "").trim();
      const amountCents = asMoneyCents(payload.amount);
      if (!institution || amountCents <= 0) return Response.json({ error: "Informe a instituição e um valor investido válido." }, { status: 400 });
      if (action === "add_investment") {
        await db.insert(investments).values({ userId: user.id, institution, amountCents });
        return Response.json({ ok: true }, { status: 201 });
      }
      const id = Number(payload.id);
      const current = await db.select().from(investments).where(and(eq(investments.id, id), eq(investments.userId, user.id))).limit(1);
      if (!current[0]) return Response.json({ error: "Investimento não encontrado." }, { status: 404 });
      await db.update(investments).set({ institution, amountCents }).where(and(eq(investments.id, id), eq(investments.userId, user.id)));
      return Response.json({ ok: true });
    }

    if (action === "toggle_loan") {
      const id = Number(payload.id);
      const rows = await db.select().from(loanInstallments).where(and(eq(loanInstallments.id, id), eq(loanInstallments.userId, user.id))).limit(1);
      if (!rows[0]) return Response.json({ error: "Parcela não encontrada." }, { status: 404 });
      await db.update(loanInstallments).set({ paid: !rows[0].paid }).where(and(eq(loanInstallments.id, id), eq(loanInstallments.userId, user.id)));
      return Response.json({ ok: true });
    }

    if (action === "delete_loan") {
      const rows = await db.select().from(loanInstallments).where(and(eq(loanInstallments.id, Number(payload.id)), eq(loanInstallments.userId, user.id))).limit(1);
      if (rows[0]) await db.delete(loanInstallments).where(and(eq(loanInstallments.recurrenceId, rows[0].recurrenceId), eq(loanInstallments.userId, user.id)));
      return Response.json({ ok: true });
    }

    if (action === "delete_transaction") await db.delete(transactions).where(and(eq(transactions.id, Number(payload.id)), eq(transactions.userId, user.id)));
    else if (action === "delete_bill") {
      const billRows = await db.select().from(bills).where(and(eq(bills.id, Number(payload.id)), eq(bills.userId, user.id))).limit(1);
      if (billRows[0]?.recurrenceId && payload.scope === "sequence") {
        await db.delete(bills).where(and(eq(bills.recurrenceId, billRows[0].recurrenceId), eq(bills.userId, user.id)));
      } else {
        await db.delete(bills).where(and(eq(bills.id, Number(payload.id)), eq(bills.userId, user.id)));
      }
    }
    else if (action === "delete_card_purchase") await db.delete(cardPurchases).where(and(eq(cardPurchases.id, Number(payload.id)), eq(cardPurchases.userId, user.id)));
    else if (action === "delete_investment") await db.delete(investments).where(and(eq(investments.id, Number(payload.id)), eq(investments.userId, user.id)));
    else if (action === "delete_card") {
      const cardId = Number(payload.id);
      await db.update(bills).set({ paymentMethod: "direct", cardId: null, cardTransferMode: "confirm", cardTransferred: false }).where(and(eq(bills.cardId, cardId), eq(bills.userId, user.id)));
      await db.delete(cardPurchases).where(and(eq(cardPurchases.cardId, cardId), eq(cardPurchases.userId, user.id)));
      await db.delete(cardInvoices).where(and(eq(cardInvoices.cardId, cardId), eq(cardInvoices.userId, user.id)));
      await db.delete(creditCards).where(and(eq(creditCards.id, cardId), eq(creditCards.userId, user.id)));
    } else return Response.json({ error: "Ação não reconhecida." }, { status: 400 });
    return Response.json({ ok: true });
  } catch (error) {
    return Response.json({ error: errorMessage(error) }, { status: 500 });
  }
}
