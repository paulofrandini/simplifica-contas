begin;

set local lock_timeout = '5s';

-- Use explicit digits so the check does not depend on SQL string escaping.
alter table public.bills
  drop constraint bills_billing_month_check,
  add constraint bills_billing_month_check
    check (billing_month = 'legacy' or billing_month ~ '^[0-9]{4}-(0[1-9]|1[0-2])$');

alter table public.card_invoices
  drop constraint card_invoices_billing_month_check,
  add constraint card_invoices_billing_month_check
    check (billing_month ~ '^[0-9]{4}-(0[1-9]|1[0-2])$');

alter table public.card_purchases
  drop constraint card_purchases_first_payment_month_check,
  add constraint card_purchases_first_payment_month_check
    check (first_payment_month ~ '^[0-9]{4}-(0[1-9]|1[0-2])$');

alter table public.loan_installments
  drop constraint loan_installments_billing_month_check,
  add constraint loan_installments_billing_month_check
    check (billing_month ~ '^[0-9]{4}-(0[1-9]|1[0-2])$');

commit;
