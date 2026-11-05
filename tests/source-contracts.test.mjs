import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const dashboard = await readFile(new URL("../app/finance-dashboard.tsx", import.meta.url), "utf8");
const css = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");
const api = await readFile(new URL("../app/api/finance/route.ts", import.meta.url), "utf8");

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

test("remove dependências de autenticação exclusivas do protótipo", () => {
  assert.doesNotMatch(dashboard, /signout-with-chatgpt/i);
  assert.doesNotMatch(api, /getChatGPTUser/);
});
