import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const dashboard = await readFile(new URL("../app/finance-dashboard.tsx", import.meta.url), "utf8");
const css = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");
const api = await readFile(new URL("../app/api/finance/route.ts", import.meta.url), "utf8");
const favicon = await readFile(new URL("../public/favicon.svg", import.meta.url), "utf8");

test("preserva as áreas do painel publicado", () => {
  for (const label of ["Visão geral", "Movimentações", "Contas do mês", "Cartões", "Investimentos"]) {
    assert.match(dashboard, new RegExp(label));
  }
  assert.match(dashboard, /summary-card investment-summary/);
  assert.match(dashboard, /commitmentPercent > 100/);
  assert.match(dashboard, /commitmentPercent === 100/);
  assert.match(dashboard, /month-history-navigation/);
});

test("mantém a navegação mobile com o botão centralizado", () => {
  assert.match(css, /\.mobile-nav\s*\{[^}]*grid-template-columns:repeat\(5,minmax\(0,1fr\)\)/s);
  assert.match(css, /\.mobile-nav \.mobile-add\s*\{[^}]*justify-self:center/s);
  assert.match(css, /@media \(max-width: 767px\)/);
});

test("usa no navegador a mesma marca turquesa do painel", () => {
  assert.match(favicon, /simplifica-gradient/);
  assert.match(favicon, /#65F7DD/);
  assert.match(favicon, /#24C9D0/);
  assert.match(favicon, /M3 11h3\.75/);
});

test("mantém todas as operações financeiras da API", () => {
  for (const action of [
    "add_transaction", "update_transaction", "toggle_transaction", "delete_transaction",
    "add_bill", "update_bill", "toggle_bill", "delete_bill",
    "add_card", "update_card", "delete_card", "update_card_invoice", "toggle_card_invoice",
    "add_card_purchase", "update_card_purchase", "delete_card_purchase",
    "add_loan", "toggle_loan", "delete_loan",
    "add_investment", "update_investment", "delete_investment",
  ]) {
    assert.match(api, new RegExp(`\\b${action}\\b`));
  }
});

test("pergunta o alcance antes de excluir uma renda recorrente", () => {
  assert.match(dashboard, /deleteIncome\("current"\)/);
  assert.match(dashboard, /deleteIncome\("sequence"\)/);
  assert.match(dashboard, /Toda a sequência/);
  assert.match(api, /payload\.scope === "sequence"/);
  assert.match(api, /transactions\.recurrenceId/);
});

test("confirma todas as exclusões com contexto antes de apagar", () => {
  assert.doesNotMatch(dashboard, /window\.confirm/);
  assert.match(dashboard, /simpleDeleteTarget/);
  assert.match(dashboard, /Todas as parcelas passadas e futuras desta compra serão removidas/);
  assert.match(dashboard, /Contas mensais vinculadas voltarão para pagamento direto/);
});

test("impede dados do mês anterior e respostas antigas ao trocar o período", () => {
  assert.match(dashboard, /loadRequestRef/);
  assert.match(dashboard, /requestId !== loadRequestRef\.current/);
  assert.match(dashboard, /loadData\(monthRef\.current\)/);
  assert.match(dashboard, /setTransactions\(\[\]\)/);
  assert.match(dashboard, /selectMonth\(event\.target\.value\)/);
});

test("evita cadastro duplicado por cliques repetidos", () => {
  assert.match(dashboard, /saveLockRef\.current/);
  assert.match(dashboard, /Aguarde a operação atual terminar/);
});

test("reabre faturas alteradas e protege operações compostas", () => {
  assert.match(api, /installmentMonths/);
  assert.match(api, /inArray\(cardInvoices\.billingMonth/);
  assert.match(api, /set: \{ amountCents: invoiceCents, paid: false \}/);
  assert.match(api, /storedAmountCents/);
  assert.match(api, /db\.transaction/);
});

test("remove dependências de autenticação exclusivas do protótipo", () => {
  assert.doesNotMatch(dashboard, /signout-with-chatgpt/i);
  assert.doesNotMatch(api, /getChatGPTUser/);
});
