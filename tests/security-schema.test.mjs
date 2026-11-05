import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const migration = await readFile(new URL("../supabase/migrations/0001_initial_schema.sql", import.meta.url), "utf8");
const envExample = await readFile(new URL("../.env.example", import.meta.url), "utf8");

test("a migração protege todas as tabelas financeiras com RLS", () => {
  for (const table of ["profiles", "transactions", "bills", "credit_cards", "card_invoices", "card_purchases", "loan_installments", "investments"]) {
    assert.match(migration, new RegExp(`['\"]?${table}['\"]?`));
  }
  assert.match(migration, /enable row level security/i);
  assert.match(migration, /revoke all on table/i);
  assert.match(migration, /auth\.uid\(\)/);
  assert.match(migration, /references auth\.users\(id\) on delete cascade/i);
});

test("o exemplo de ambiente não contém credenciais reais", () => {
  assert.match(envExample, /YOUR_PROJECT_REF/);
  assert.match(envExample, /YOUR_URL_ENCODED_PASSWORD/);
  assert.doesNotMatch(envExample, /service_role/i);
});
