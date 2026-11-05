import {
  boolean,
  index,
  integer,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

export const profiles = pgTable("profiles", {
  id: uuid("id").primaryKey(),
  email: text("email").notNull(),
  displayName: text("display_name"),
  plan: text("plan").notNull().default("free"),
  incomeConfirmationVersion: integer("income_confirmation_version").notNull().default(0),
  cardWorkflowVersion: integer("card_workflow_version").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "string" }).notNull().defaultNow(),
});

export const transactions = pgTable("transactions", {
  id: serial("id").primaryKey(),
  userId: uuid("user_id").notNull().references(() => profiles.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  category: text("category").notNull(),
  amountCents: integer("amount_cents").notNull(),
  type: text("type").$type<"income" | "expense">().notNull(),
  icon: text("icon").notNull().default("food"),
  transactionDate: timestamp("transaction_date", { withTimezone: true, mode: "string" }).notNull().defaultNow(),
  recurrenceId: uuid("recurrence_id"),
  paid: boolean("paid").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "string" }).notNull().defaultNow(),
}, (table) => [index("transactions_user_date_idx").on(table.userId, table.transactionDate)]);

export const bills = pgTable("bills", {
  id: serial("id").primaryKey(),
  userId: uuid("user_id").notNull().references(() => profiles.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  amountCents: integer("amount_cents").notNull(),
  dueLabel: text("due_label").notNull(),
  dueDay: integer("due_day").notNull().default(1),
  billingMonth: text("billing_month").notNull().default("legacy"),
  recurrenceId: uuid("recurrence_id"),
  category: text("category").notNull().default("Outros"),
  paid: boolean("paid").notNull().default(false),
  icon: text("icon").notNull().default("home"),
  paymentMethod: text("payment_method").$type<"direct" | "card">().notNull().default("direct"),
  cardId: integer("card_id"),
  cardTransferMode: text("card_transfer_mode").$type<"automatic" | "confirm">().notNull().default("confirm"),
  cardTransferred: boolean("card_transferred").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "string" }).notNull().defaultNow(),
}, (table) => [index("bills_user_idx").on(table.userId)]);

export const creditCards = pgTable("credit_cards", {
  id: serial("id").primaryKey(),
  userId: uuid("user_id").notNull().references(() => profiles.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  lastFour: text("last_four").notNull().default("0000"),
  brand: text("brand").notNull().default("BANCO"),
  limitCents: integer("limit_cents").notNull().default(0),
  invoiceCents: integer("invoice_cents").notNull().default(0),
  dueDay: integer("due_day").notNull().default(10),
  managementMode: text("management_mode").$type<"total" | "items">().notNull().default("total"),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "string" }).notNull().defaultNow(),
}, (table) => [index("credit_cards_user_idx").on(table.userId)]);

export const cardInvoices = pgTable("card_invoices", {
  id: serial("id").primaryKey(),
  userId: uuid("user_id").notNull().references(() => profiles.id, { onDelete: "cascade" }),
  cardId: integer("card_id").notNull().references(() => creditCards.id, { onDelete: "cascade" }),
  billingMonth: text("billing_month").notNull(),
  amountCents: integer("amount_cents").notNull().default(0),
  paid: boolean("paid").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "string" }).notNull().defaultNow(),
}, (table) => [
  index("card_invoices_user_month_idx").on(table.userId, table.billingMonth),
  uniqueIndex("card_invoices_card_month_uidx").on(table.cardId, table.billingMonth),
]);

export const cardPurchases = pgTable("card_purchases", {
  id: serial("id").primaryKey(),
  userId: uuid("user_id").notNull().references(() => profiles.id, { onDelete: "cascade" }),
  cardId: integer("card_id").notNull().references(() => creditCards.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  totalCents: integer("total_cents").notNull(),
  installmentCount: integer("installment_count").notNull().default(1),
  firstPaymentMonth: text("first_payment_month").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "string" }).notNull().defaultNow(),
}, (table) => [index("card_purchases_user_card_idx").on(table.userId, table.cardId)]);

export const loanInstallments = pgTable("loan_installments", {
  id: serial("id").primaryKey(),
  userId: uuid("user_id").notNull().references(() => profiles.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  kind: text("kind").$type<"loan" | "bank_limit">().notNull().default("loan"),
  amountCents: integer("amount_cents").notNull(),
  billingMonth: text("billing_month").notNull(),
  installmentNumber: integer("installment_number").notNull(),
  installmentCount: integer("installment_count").notNull(),
  recurrenceId: uuid("recurrence_id").notNull(),
  paid: boolean("paid").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "string" }).notNull().defaultNow(),
}, (table) => [index("loan_installments_user_month_idx").on(table.userId, table.billingMonth)]);

export const investments = pgTable("investments", {
  id: serial("id").primaryKey(),
  userId: uuid("user_id").notNull().references(() => profiles.id, { onDelete: "cascade" }),
  institution: text("institution").notNull(),
  amountCents: integer("amount_cents").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "string" }).notNull().defaultNow(),
}, (table) => [index("investments_user_idx").on(table.userId)]);
