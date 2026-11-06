"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRight, Banknote, Briefcase, Calculator, CalendarDays, Car, Check, CircleParking, Cloud,
  ChevronLeft, ChevronRight, CircleDollarSign, CreditCard, Gift, HelpCircle,
  Droplets, Dumbbell, Fuel, GraduationCap, Home, Landmark, LayoutDashboard,
  HandCoins, Lightbulb, ListPlus, LogOut, MousePointerClick, Palette, PawPrint, Pencil, Phone,
  PiggyBank, PlayCircle, Plus, ReceiptText, Save, Search, ShieldCheck, ShoppingBag, Sparkles, Trash2,
  Building2, Clock3,
  Utensils, WalletCards, Wifi, Zap,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Sidebar, SidebarContent, SidebarFooter, SidebarGroup, SidebarGroupContent,
  SidebarHeader, SidebarInset, SidebarMenu, SidebarMenuButton, SidebarMenuItem,
  SidebarProvider,
} from "@/components/ui/sidebar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Toaster } from "@/components/ui/sonner";
import { createClient } from "@/lib/supabase/client";

type Transaction = {
  id: number;
  title: string;
  category: string;
  amount: number;
  type: "income" | "expense";
  paid: boolean;
  date: string;
  recurrenceId: string | null;
};

type Bill = {
  id: number;
  title: string;
  amount: number;
  dueDay: number;
  paid: boolean;
  recurrenceId: string | null;
  category: string;
  icon: string;
  billingMonth: string;
  paymentMethod: "direct" | "card";
  cardId: number | null;
  cardName: string | null;
  cardTransferMode: "automatic" | "confirm";
  cardTransferred: boolean;
  cardInvoicePaid: boolean;
  paymentMonth: string;
  countsAsBill: boolean;
};

type LinkedBill = { id: number; title: string; amount: number; sourceMonth: string };

type FinanceCard = {
  id: number;
  bank: string;
  invoice: number;
  manualInvoice: number;
  estimatedFromBills: boolean;
  dueDay: number;
  managementMode: "total" | "items";
  paid: boolean;
  invoiceMonth: string;
  purchases: CardPurchase[];
  linkedBills: LinkedBill[];
};

type CardPurchase = {
  id: number;
  title: string;
  total: number;
  installmentAmount: number;
  installmentCount: number;
  firstPaymentMonth: string;
  installmentNumber: number;
  remainingInstallments: number;
  amount: number;
};

type LoanInstallment = {
  id: number;
  title: string;
  kind: "loan" | "bank_limit";
  amount: number;
  billingMonth: string;
  installmentNumber: number;
  installmentCount: number;
  paid: boolean;
};

type Payment = {
  id: string;
  sourceId: number;
  sourceType: "transaction" | "bill" | "card" | "loan";
  title: string;
  category: string;
  amount: number;
  type: "income" | "payment";
  status: "received" | "paid" | "pending" | "card_linked" | "card_paid" | "card_planned";
  date: string;
};

type Investment = { id: number; institution: string; amount: number };

type MonthHistory = { month: string; total: number };

type FinanceSummary = {
  income: number;
  receivedIncome: number;
  incidental: number;
  bills: number;
  cards: number;
  credit: number;
  committed: number;
  paidExpenses: number;
  paidBills: number;
  paidCards: number;
  paidCredit: number;
  realizedOutflows: number;
  availableForecast: number;
  availableRealized: number;
};

const emptySummary: FinanceSummary = {
  income: 0, receivedIncome: 0, incidental: 0, bills: 0, cards: 0, credit: 0,
  committed: 0, paidExpenses: 0, paidBills: 0, paidCards: 0, paidCredit: 0,
  realizedOutflows: 0, availableForecast: 0, availableRealized: 0,
};

type EntryTab = "income" | "expense" | "bill" | "card" | "loan" | "investment";
type View = "Visão geral" | "Movimentações" | "Contas do mês" | "Cartões" | "Investimentos";
type SimpleDeleteAction = "delete_transaction" | "delete_card" | "delete_card_purchase" | "delete_loan" | "delete_investment";
type SimpleDeleteTarget = {
  action: SimpleDeleteAction;
  id: number;
  title: string;
  description: string;
  success: string;
};

const currency = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const monthFormatter = new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric", timeZone: "UTC" });
const dateFormatter = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short", timeZone: "UTC" });

const navItems: { label: View; icon: typeof LayoutDashboard }[] = [
  { label: "Visão geral", icon: LayoutDashboard },
  { label: "Movimentações", icon: ReceiptText },
  { label: "Contas do mês", icon: CalendarDays },
  { label: "Cartões", icon: CreditCard },
  { label: "Investimentos", icon: PiggyBank },
];

function currentMonthKey() {
  const today = new Date();
  return today.getFullYear() + "-" + String(today.getMonth() + 1).padStart(2, "0");
}

function shiftMonth(month: string, offset: number) {
  const parts = month.split("-").map(Number);
  return new Date(Date.UTC(parts[0], parts[1] - 1 + offset, 1)).toISOString().slice(0, 7);
}

function monthLabel(month: string) {
  const parts = month.split("-").map(Number);
  const label = monthFormatter.format(new Date(Date.UTC(parts[0], parts[1] - 1, 1)));
  return label.charAt(0).toUpperCase() + label.slice(1);
}

function moneyText(amount: number) {
  return amount.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function parseMoneyText(value: string) {
  let raw = value.trim().replace(/R\$/gi, "").replace(/\s/g, "");
  if (raw.includes(",") && raw.includes(".")) raw = raw.lastIndexOf(",") > raw.lastIndexOf(".") ? raw.replace(/\./g, "").replace(",", ".") : raw.replace(/,/g, "");
  else if (raw.includes(",")) raw = raw.replace(/\./g, "").replace(",", ".");
  else if (raw.includes(".") && !/^\d+\.\d{1,2}$/.test(raw)) raw = raw.replace(/\./g, "");
  const amount = Number(raw);
  return Number.isFinite(amount) ? amount : 0;
}

function normalizeMoneyField(event: React.FocusEvent<HTMLInputElement>) {
  event.currentTarget.value = moneyText(parseMoneyText(event.currentTarget.value));
}

function transactionIcon(item: Transaction) {
  if (item.type === "income") return Landmark;
  if (item.category === "Alimentação") return Utensils;
  if (item.category === "Moradia") return Home;
  return ReceiptText;
}

function paymentIcon(item: Payment) {
  if (item.type === "income") return Landmark;
  if (item.sourceType === "card") return CreditCard;
  if (item.sourceType === "loan") return HandCoins;
  if (item.sourceType === "bill") return CalendarDays;
  return ReceiptText;
}

function billIcon(icon: string) {
  const icons: Record<string, typeof ReceiptText> = {
    home: Home, water: Droplets, energy: Zap, wifi: Wifi, phone: Phone,
    streaming: PlayCircle, cloud: Cloud, pet: PawPrint, fitness: Dumbbell,
    car: Car, fuel: Fuel, parking: CircleParking, education: GraduationCap,
    tax: Briefcase, accounting: Calculator, design: Palette, cleaning: Sparkles,
  };
  return icons[icon] || ReceiptText;
}

function EmptyState({ icon: Icon, title, copy, action, onAction }: {
  icon: typeof CreditCard;
  title: string;
  copy: string;
  action?: string;
  onAction?: () => void;
}) {
  return (
    <div className="module-empty">
      <span><Icon size={22} /></span>
      <strong>{title}</strong>
      <p>{copy}</p>
      {action && onAction && <button onClick={onAction}><Plus size={15} /> {action}</button>}
    </div>
  );
}

function EntryDialog({ open, setOpen, tab, setTab, month, cards, save }: {
  open: boolean;
  setOpen: (open: boolean) => void;
  tab: EntryTab;
  setTab: (tab: EntryTab) => void;
  month: string;
  cards: FinanceCard[];
  save: (payload: Record<string, unknown>, success: string) => Promise<boolean>;
}) {
  const [cardMode, setCardMode] = useState<"total" | "items">("total");
  const [billPaymentMethod, setBillPaymentMethod] = useState<"direct" | "card">("direct");

  async function submit(event: React.FormEvent<HTMLFormElement>, payload: Record<string, unknown>, message: string) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const fields = Object.fromEntries(form.entries());
    if (await save({ ...payload, ...fields, month }, message)) setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="entry-dialog">
        <DialogHeader>
          <DialogTitle>Adicionar ao seu mês</DialogTitle>
          <DialogDescription>Escolha uma opção. Nenhum dado bancário sensível é solicitado.</DialogDescription>
        </DialogHeader>
        <Tabs value={tab} onValueChange={(value) => setTab(value as EntryTab)}>
          <TabsList className="entry-tabs">
            <TabsTrigger value="income">Renda</TabsTrigger>
            <TabsTrigger value="expense">Gasto</TabsTrigger>
            <TabsTrigger value="bill">Conta mensal</TabsTrigger>
            <TabsTrigger value="card">Cartão</TabsTrigger>
            <TabsTrigger value="loan">Crédito</TabsTrigger>
            <TabsTrigger value="investment">Investimento</TabsTrigger>
          </TabsList>

          <TabsContent value="income">
            <form className="entry-form" onSubmit={(event) => void submit(event, { action: "add_transaction", type: "income" }, "Renda cadastrada")}>
              <label>Nome da renda<Input name="title" placeholder="Ex.: Salário, freelance ou aluguel" required /></label>
              <div className="form-grid">
                <label>Valor mensal<Input name="amount" inputMode="decimal" placeholder="Ex.: 3500,00" onBlur={normalizeMoneyField} required /></label>
                <label>Dia do recebimento<Input name="day" type="number" min={1} max={28} defaultValue={5} required /></label>
              </div>
              <label>Repetir esta renda
                <Select name="repeatMonths" defaultValue="12">
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">Somente neste mês</SelectItem>
                    <SelectItem value="6">Durante 6 meses</SelectItem>
                    <SelectItem value="12">Durante 12 meses</SelectItem>
                  </SelectContent>
                </Select>
              </label>
              <p className="form-hint"><Sparkles size={14} /> Você pode cadastrar quantas fontes de renda precisar.</p>
              <Button type="submit" className="submit-button">Cadastrar renda</Button>
            </form>
          </TabsContent>

          <TabsContent value="expense">
            <form className="entry-form" onSubmit={(event) => void submit(event, { action: "add_transaction", type: "expense", repeatMonths: "1" }, "Gasto cadastrado")}>
              <label>Descrição<Input name="title" placeholder="Ex.: Supermercado" required /></label>
              <div className="form-grid">
                <label>Valor<Input name="amount" inputMode="decimal" placeholder="Ex.: 185,90" onBlur={normalizeMoneyField} required /></label>
                <label>Dia do gasto<Input name="day" type="number" min={1} max={28} defaultValue={Math.min(28, new Date().getDate())} required /></label>
              </div>
              <label>Categoria
                <Select name="category" defaultValue="Alimentação">
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Alimentação">Alimentação</SelectItem>
                    <SelectItem value="Moradia">Moradia</SelectItem>
                    <SelectItem value="Transporte">Transporte</SelectItem>
                    <SelectItem value="Saúde">Saúde</SelectItem>
                    <SelectItem value="Lazer">Lazer</SelectItem>
                    <SelectItem value="Outros">Outros</SelectItem>
                  </SelectContent>
                </Select>
              </label>
              <p className="form-hint"><MousePointerClick size={14} /> O gasto ficará pendente até você marcar que foi pago.</p>
              <Button type="submit" className="submit-button">Cadastrar gasto pendente</Button>
            </form>
          </TabsContent>

          <TabsContent value="bill">
            <form className="entry-form" onSubmit={(event) => void submit(event, { action: "add_bill" }, "Contas mensais cadastradas")}>
              <label>Nome da conta<Input name="title" placeholder="Ex.: Aluguel, energia ou internet" required /></label>
              <div className="form-grid">
                <label>Valor mensal<Input name="amount" inputMode="decimal" placeholder="Ex.: 149,90" onBlur={normalizeMoneyField} required /></label>
                <label>Dia do vencimento<Input name="dueDay" type="number" min={1} max={28} defaultValue={10} required /></label>
              </div>
              <label>Categoria e ícone
                <Select name="category" defaultValue="Automático">
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Automático">Escolher automaticamente pelo nome</SelectItem>
                    <SelectItem value="Casa">Casa</SelectItem>
                    <SelectItem value="Moradia">Moradia</SelectItem>
                    <SelectItem value="Conectividade">Conectividade</SelectItem>
                    <SelectItem value="Assinaturas">Assinaturas</SelectItem>
                    <SelectItem value="Transporte">Transporte</SelectItem>
                    <SelectItem value="Educação">Educação</SelectItem>
                    <SelectItem value="Saúde">Saúde</SelectItem>
                    <SelectItem value="Pets">Pets</SelectItem>
                    <SelectItem value="Trabalho">Trabalho</SelectItem>
                    <SelectItem value="Impostos">Impostos</SelectItem>
                    <SelectItem value="Serviços">Serviços</SelectItem>
                    <SelectItem value="Outros">Outros</SelectItem>
                  </SelectContent>
                </Select>
              </label>
              <label>Como esta conta é paga?
                <Select name="paymentMethod" value={billPaymentMethod} onValueChange={(value) => setBillPaymentMethod(value as "direct" | "card")}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="direct">Pix, boleto ou débito</SelectItem>
                    <SelectItem value="card" disabled={cards.length === 0}>Cartão de crédito</SelectItem>
                  </SelectContent>
                </Select>
              </label>
              {billPaymentMethod === "card" && cards.length > 0 && <>
                <label>Qual cartão?
                  <Select name="cardId" defaultValue={String(cards[0].id)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{cards.map((card) => <SelectItem key={card.id} value={String(card.id)}>{card.bank}</SelectItem>)}</SelectContent></Select>
                </label>
                <p className="form-hint"><CreditCard size={14} /> A conta ficará prevista no cartão. Em cada mês, use “Incluir na fatura” quando confirmar a cobrança.</p>
              </>}
              {billPaymentMethod === "card" && cards.length === 0 && <p className="form-hint"><CreditCard size={14} /> Cadastre um cartão antes de vincular esta conta.</p>}
              <label>Gerar esta conta
                <Select name="repeatMonths" defaultValue="12">
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">Somente neste mês</SelectItem>
                    <SelectItem value="6">Nos próximos 6 meses</SelectItem>
                    <SelectItem value="12">Nos próximos 12 meses</SelectItem>
                  </SelectContent>
                </Select>
              </label>
              <p className="form-hint"><CalendarDays size={14} /> {billPaymentMethod === "card" ? "Cada mês ficará separado: primeiro você confirma a inclusão e depois confirma o pagamento pela fatura." : "Cada mês será criado separadamente para você confirmar o pagamento."}</p>
              <Button type="submit" className="submit-button">Cadastrar conta</Button>
            </form>
          </TabsContent>

          <TabsContent value="card">
            <form className="entry-form" onSubmit={(event) => void submit(event, { action: "add_card" }, "Cartão adicionado")}>
              <label>Banco ou apelido do cartão<Input name="bank" placeholder="Ex.: Nubank ou Cartão do mercado" required /></label>
              <label>Como você quer controlar este cartão?
                <Select name="managementMode" value={cardMode} onValueChange={(value) => setCardMode(value as "total" | "items")}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="total">Informar apenas o total de cada mês</SelectItem>
                    <SelectItem value="items">Cadastrar compras e parcelas separadamente</SelectItem>
                  </SelectContent>
                </Select>
              </label>
              <label>Dia do vencimento<Input name="dueDay" type="number" min={1} max={28} defaultValue={10} required /></label>
              {cardMode === "total" ? <>
                <input type="hidden" name="paymentMonth" value={month} />
                <label>Valor para {monthLabel(month)}<Input name="invoice" inputMode="decimal" defaultValue="0,00" onBlur={normalizeMoneyField} required /></label>
                <p className="form-hint"><CalendarDays size={14} /> Este valor pertence ao mês que está selecionado no painel: {monthLabel(month)}.</p>
              </> : <p className="form-hint"><ListPlus size={14} /> Depois de adicionar o cartão, cadastre cada compra, o valor da parcela e quantas parcelas ainda serão lançadas.</p>}
              <div className="security-note"><ShieldCheck size={17} /><span>Não pedimos número, validade, limite, bandeira ou código de segurança.</span></div>
              <Button type="submit" className="submit-button">Adicionar cartão</Button>
            </form>
          </TabsContent>

          <TabsContent value="loan">
            <form className="entry-form" onSubmit={(event) => void submit(event, { action: "add_loan" }, "Parcelas cadastradas nos próximos meses")}>
              <label>Tipo de crédito
                <Select name="kind" defaultValue="loan"><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="loan">Empréstimo</SelectItem><SelectItem value="bank_limit">Uso de limite bancário</SelectItem></SelectContent></Select>
              </label>
              <label>Nome<Input name="title" placeholder="Ex.: Empréstimo pessoal ou limite Itaú" required /></label>
              <div className="form-grid">
                <label>Valor de cada parcela<Input name="installmentAmount" inputMode="decimal" placeholder="Ex.: 100,00" onBlur={normalizeMoneyField} required /></label>
                <label>Quantidade de parcelas<Input name="installmentCount" type="number" min={1} max={60} defaultValue={10} required /></label>
              </div>
              <label>Primeiro mês da parcela<Input name="firstPaymentMonth" type="month" defaultValue={month} required /></label>
              <p className="form-hint"><CalendarDays size={14} /> Exemplo: 10 parcelas de R$ 100 criam R$ 100 neste e nos próximos 9 meses. Excluir remove toda a sequência.</p>
              <Button type="submit" className="submit-button">Cadastrar todas as parcelas</Button>
            </form>
          </TabsContent>

          <TabsContent value="investment">
            <form className="entry-form" onSubmit={(event) => void submit(event, { action: "add_investment" }, "Investimento cadastrado") }>
              <label>Banco ou instituição<Input name="institution" placeholder="Ex.: Itaú, XP ou Tesouro Direto" required /></label>
              <label>Valor atualmente investido<Input name="amount" inputMode="decimal" placeholder="Ex.: 5000,00" onBlur={normalizeMoneyField} required /></label>
              <p className="form-hint"><PiggyBank size={14} /> Este valor é apenas informativo e não altera sua renda, seu saldo ou seus compromissos.</p>
              <Button type="submit" className="submit-button">Cadastrar investimento</Button>
            </form>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

function InvoiceEditor({ card, month, save, edit, remove, addPurchase, editPurchase, removePurchase }: {
  card: FinanceCard;
  month: string;
  save: (payload: Record<string, unknown>, success: string) => Promise<boolean>;
  edit: () => void;
  remove: () => void;
  addPurchase: () => void;
  editPurchase: (purchase: CardPurchase) => void;
  removePurchase: (purchase: CardPurchase) => void;
}) {
  const [value, setValue] = useState(moneyText(card.manualInvoice));

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setValue(moneyText(parseMoneyText(value)));
    await save({ action: "update_card_invoice", id: card.id, invoice: value, month }, "Valor de " + monthLabel(month) + " salvo");
  }

  return (
    <article className={"simple-card " + (card.paid ? "paid-card" : "")}>
      <div className="simple-card-icon"><CreditCard size={21} /></div>
      <div className="simple-card-copy"><span>{card.managementMode === "items" ? "Compras detalhadas" : "Total por mês"}</span><strong>{card.bank}</strong><small>Vence dia {card.dueDay} · {monthLabel(month)}</small></div>
      <div className="card-actions"><button onClick={edit} aria-label={"Editar " + card.bank}><Pencil size={14} /></button><button onClick={remove} aria-label={"Excluir " + card.bank}><Trash2 size={15} /></button></div>
      {card.managementMode === "total" ? (
        <form onSubmit={(event) => void submit(event)}>
          <label>Valor total de {monthLabel(month)}<Input value={value} onChange={(event) => setValue(event.target.value)} onBlur={() => setValue(moneyText(parseMoneyText(value)))} inputMode="decimal" aria-label={"Valor total de " + card.bank + " em " + monthLabel(month)} /></label>
          <Button type="submit"><Save size={14} /> Salvar valor</Button>
        </form>
      ) : (
        <div className="card-purchases">
          <div className="card-purchases-heading"><span>Compras que entram neste mês</span><button onClick={addPurchase}><Plus size={13} /> Compra</button></div>
          {card.purchases.length ? card.purchases.map((purchase) => (
            <div className="card-purchase-row" key={purchase.id}>
              <ShoppingBag size={14} />
              <div><strong>{purchase.title}</strong><span>Parcela {purchase.installmentNumber}/{purchase.installmentCount} · faltam {purchase.remainingInstallments}</span></div>
              <b>{currency.format(purchase.amount)}</b>
              <button onClick={() => editPurchase(purchase)} aria-label={"Editar " + purchase.title}><Pencil size={13} /></button>
              <button onClick={() => removePurchase(purchase)} aria-label={"Excluir todas as parcelas de " + purchase.title}><Trash2 size={13} /></button>
            </div>
          )) : <p className="card-purchases-empty">Nenhuma compra entra em {monthLabel(month)}. Cadastre uma compra ou navegue para outro mês.</p>}
        </div>
      )}
      {card.linkedBills.length > 0 && <div className="linked-bills">
        <span>Contas mensais incluídas nesta fatura</span>
        {card.linkedBills.map((bill) => <div key={bill.id}><CreditCard size={13} /><p><strong>{bill.title}</strong><small>Conta de {monthLabel(bill.sourceMonth)}</small></p><b>{currency.format(bill.amount)}</b></div>)}
        {card.managementMode === "total" && <small>Esses valores já fazem parte do total informado e não serão somados novamente.</small>}
      </div>}
      <div className="invoice-total-line"><span>{card.estimatedFromBills ? "Total previsto pelas contas vinculadas" : "Total do mês"}</span><strong>{currency.format(card.invoice)}</strong></div>
      <button className={"payment-toggle " + (card.paid ? "paid" : "")} onClick={() => void save({ action: "toggle_card_invoice", id: card.id, month }, card.paid ? "Fatura voltou para pendente" : "Fatura marcada como paga")}><Check size={14} /> {card.paid ? "Fatura paga · desfazer" : "Marcar fatura como paga"}</button>
    </article>
  );
}

function BillEditDialog({ bill, open, setOpen, cards, save }: {
  bill: Bill | null;
  open: boolean;
  setOpen: (open: boolean) => void;
  cards: FinanceCard[];
  save: (payload: Record<string, unknown>, success: string) => Promise<boolean>;
}) {
  const [paymentMethod, setPaymentMethod] = useState<"direct" | "card">(bill?.paymentMethod || "direct");
  if (!bill) return null;
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const fields = Object.fromEntries(new FormData(event.currentTarget).entries());
    if (await save({ action: "update_bill", id: bill!.id, ...fields }, "Conta atualizada")) setOpen(false);
  }
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="entry-dialog">
        <DialogHeader><DialogTitle>Editar conta mensal</DialogTitle><DialogDescription>Você pode alterar somente este mês ou também os próximos desta sequência.</DialogDescription></DialogHeader>
        <form className="entry-form" onSubmit={(event) => void submit(event)}>
          <label>Nome da conta<Input name="title" defaultValue={bill.title} required /></label>
          <div className="form-grid">
            <label>Valor mensal<Input name="amount" inputMode="decimal" defaultValue={moneyText(bill.amount)} onBlur={normalizeMoneyField} required /></label>
            <label>Dia do vencimento<Input name="dueDay" type="number" min={1} max={28} defaultValue={bill.dueDay} required /></label>
          </div>
          <label>Categoria e ícone
            <Select name="category" defaultValue={bill.category || "Automático"}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {["Automático", "Casa", "Moradia", "Conectividade", "Assinaturas", "Transporte", "Educação", "Saúde", "Pets", "Trabalho", "Impostos", "Serviços", "Outros"].map((category) => <SelectItem key={category} value={category}>{category}</SelectItem>)}
              </SelectContent>
            </Select>
          </label>
          <label>Como esta conta é paga?
            <Select name="paymentMethod" value={paymentMethod} onValueChange={(value) => setPaymentMethod(value as "direct" | "card")}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="direct">Pix, boleto ou débito</SelectItem><SelectItem value="card" disabled={cards.length === 0}>Cartão de crédito</SelectItem></SelectContent></Select>
          </label>
          {paymentMethod === "card" && cards.length > 0 && <>
            <label>Qual cartão?
              <Select name="cardId" defaultValue={bill.cardId ? String(bill.cardId) : String(cards[0].id)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{cards.map((card) => <SelectItem key={card.id} value={String(card.id)}>{card.bank}</SelectItem>)}</SelectContent></Select>
            </label>
            <p className="form-hint"><CreditCard size={14} /> A conta ficará prevista e será incluída somente quando você confirmar no mês correspondente.</p>
          </>}
          <label>Aplicar alteração
            <Select name="scope" defaultValue="future">
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="current">Somente neste mês</SelectItem>
                <SelectItem value="future">Neste e nos próximos meses</SelectItem>
              </SelectContent>
            </Select>
          </label>
          <Button type="submit" className="submit-button">Salvar alterações</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function CardEditDialog({ card, open, setOpen, save }: {
  card: FinanceCard | null;
  open: boolean;
  setOpen: (open: boolean) => void;
  save: (payload: Record<string, unknown>, success: string) => Promise<boolean>;
}) {
  if (!card) return null;
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const fields = Object.fromEntries(new FormData(event.currentTarget).entries());
    if (await save({ action: "update_card", id: card!.id, ...fields }, "Cartão atualizado")) setOpen(false);
  }
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="entry-dialog">
        <DialogHeader><DialogTitle>Editar cartão</DialogTitle><DialogDescription>Altere os dados básicos e escolha como deseja controlar os valores.</DialogDescription></DialogHeader>
        <form className="entry-form" onSubmit={(event) => void submit(event)}>
          <label>Banco ou apelido<Input name="bank" defaultValue={card.bank} required /></label>
          <label>Dia do vencimento<Input name="dueDay" type="number" min={1} max={28} defaultValue={card.dueDay} required /></label>
          <label>Forma de controle
            <Select name="managementMode" defaultValue={card.managementMode}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="total">Informar apenas o total de cada mês</SelectItem><SelectItem value="items">Cadastrar compras e parcelas separadamente</SelectItem></SelectContent></Select>
          </label>
          <p className="form-hint"><ShieldCheck size={14} /> Alterar o modo não apaga valores nem compras já cadastrados.</p>
          <Button type="submit" className="submit-button">Salvar cartão</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function IncomeEditDialog({ income, open, setOpen, save }: {
  income: Transaction | null;
  open: boolean;
  setOpen: (open: boolean) => void;
  save: (payload: Record<string, unknown>, success: string) => Promise<boolean>;
}) {
  if (!income) return null;
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const fields = Object.fromEntries(new FormData(event.currentTarget).entries());
    if (await save({ action: "update_transaction", id: income!.id, ...fields }, "Renda atualizada")) setOpen(false);
  }
  return (
    <Dialog open={open} onOpenChange={setOpen}><DialogContent className="entry-dialog">
      <DialogHeader><DialogTitle>Editar renda</DialogTitle><DialogDescription>{income.recurrenceId ? "Escolha se a alteração vale somente para este mês ou também para os próximos desta sequência." : "Esta renda existe somente neste mês."}</DialogDescription></DialogHeader>
      <form className="entry-form" onSubmit={(event) => void submit(event)}>
        <label>Nome da renda<Input name="title" defaultValue={income.title} required /></label>
        <div className="form-grid">
          <label>Valor<Input name="amount" inputMode="decimal" defaultValue={moneyText(income.amount)} onBlur={normalizeMoneyField} required /></label>
          <label>Dia do recebimento<Input name="day" type="number" min={1} max={28} defaultValue={new Date(income.date).getUTCDate()} required /></label>
        </div>
        {income.recurrenceId ? <label>Aplicar alteração
          <Select name="scope" defaultValue="future"><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="current">Somente neste mês</SelectItem><SelectItem value="future">Neste e nos próximos meses</SelectItem></SelectContent></Select>
        </label> : <input type="hidden" name="scope" value="current" />}
        <p className="form-hint"><CalendarDays size={14} /> Meses anteriores não serão alterados.</p>
        <Button type="submit" className="submit-button">Salvar renda</Button>
      </form>
    </DialogContent></Dialog>
  );
}

function InvestmentEditDialog({ investment, open, setOpen, save }: {
  investment: Investment | null;
  open: boolean;
  setOpen: (open: boolean) => void;
  save: (payload: Record<string, unknown>, success: string) => Promise<boolean>;
}) {
  if (!investment) return null;
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const fields = Object.fromEntries(new FormData(event.currentTarget).entries());
    if (await save({ action: "update_investment", id: investment!.id, ...fields }, "Investimento atualizado")) setOpen(false);
  }
  return (
    <Dialog open={open} onOpenChange={setOpen}><DialogContent className="entry-dialog">
      <DialogHeader><DialogTitle>Editar investimento</DialogTitle><DialogDescription>Atualize o saldo informado para esta instituição.</DialogDescription></DialogHeader>
      <form className="entry-form" onSubmit={(event) => void submit(event)}>
        <label>Banco ou instituição<Input name="institution" defaultValue={investment.institution} required /></label>
        <label>Valor atualmente investido<Input name="amount" inputMode="decimal" defaultValue={moneyText(investment.amount)} onBlur={normalizeMoneyField} required /></label>
        <p className="form-hint"><PiggyBank size={14} /> O investimento continua separado dos cálculos financeiros mensais.</p>
        <Button type="submit" className="submit-button">Salvar investimento</Button>
      </form>
    </DialogContent></Dialog>
  );
}

function ExpenseEditDialog({ expense, open, setOpen, save }: {
  expense: Transaction | null;
  open: boolean;
  setOpen: (open: boolean) => void;
  save: (payload: Record<string, unknown>, success: string) => Promise<boolean>;
}) {
  if (!expense) return null;
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const fields = Object.fromEntries(new FormData(event.currentTarget).entries());
    if (await save({ action: "update_transaction", id: expense!.id, ...fields }, "Gasto atualizado")) setOpen(false);
  }
  return (
    <Dialog open={open} onOpenChange={setOpen}><DialogContent className="entry-dialog">
      <DialogHeader><DialogTitle>Editar gasto avulso</DialogTitle><DialogDescription>O gasto continua pendente até você marcar que ele foi pago.</DialogDescription></DialogHeader>
      <form className="entry-form" onSubmit={(event) => void submit(event)}>
        <label>Descrição<Input name="title" defaultValue={expense.title} required /></label>
        <div className="form-grid">
          <label>Valor<Input name="amount" inputMode="decimal" defaultValue={moneyText(expense.amount)} onBlur={normalizeMoneyField} required /></label>
          <label>Dia<Input name="day" type="number" min={1} max={28} defaultValue={new Date(expense.date).getUTCDate()} required /></label>
        </div>
        <label>Categoria<Select name="category" defaultValue={expense.category}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{["Alimentação", "Moradia", "Transporte", "Saúde", "Lazer", "Outros"].map((category) => <SelectItem key={category} value={category}>{category}</SelectItem>)}</SelectContent></Select></label>
        <Button type="submit" className="submit-button">Salvar gasto</Button>
      </form>
    </DialogContent></Dialog>
  );
}

function CardPurchaseDialog({ data, month, setOpen, save }: {
  data: { card: FinanceCard; purchase?: CardPurchase } | null;
  month: string;
  setOpen: (open: boolean) => void;
  save: (payload: Record<string, unknown>, success: string) => Promise<boolean>;
}) {
  if (!data) return null;
  const purchase = data.purchase;
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const fields = Object.fromEntries(new FormData(event.currentTarget).entries());
    const payload = purchase ? { action: "update_card_purchase", id: purchase.id, ...fields } : { action: "add_card_purchase", cardId: data!.card.id, ...fields };
    if (await save(payload, purchase ? "Compra parcelada atualizada em todos os meses" : "Compra incluída a partir do mês escolhido")) setOpen(false);
  }
  return (
    <Dialog open={Boolean(data)} onOpenChange={setOpen}><DialogContent className="entry-dialog">
      <DialogHeader><DialogTitle>{purchase ? "Editar compra parcelada" : "Adicionar compra ao " + data.card.bank}</DialogTitle><DialogDescription>Informe o valor de cada parcela. A sequência será criada automaticamente nos meses seguintes.</DialogDescription></DialogHeader>
      <form className="entry-form" onSubmit={(event) => void submit(event)}>
        <label>Nome da compra<Input name="title" defaultValue={purchase?.title || ""} placeholder="Ex.: Celular ou supermercado" required /></label>
        <div className="form-grid">
          <label>Valor de cada parcela<Input name="installmentAmount" inputMode="decimal" defaultValue={purchase ? moneyText(purchase.installmentAmount) : ""} placeholder="Ex.: 100,00" onBlur={normalizeMoneyField} required /></label>
          <label>Quantidade de parcelas<Input name="installmentCount" type="number" min={1} max={60} defaultValue={purchase?.installmentCount || 1} required /></label>
        </div>
        <label>Primeiro mês da parcela<Input name="firstPaymentMonth" type="month" defaultValue={purchase?.firstPaymentMonth || month} required /></label>
        <p className="form-hint"><CalendarDays size={14} /> Por padrão, a primeira parcela entra no mês que está selecionado no painel.</p>
        <div className="security-note"><ShieldCheck size={17} /><span>Ao excluir esta compra depois, todas as parcelas futuras e passadas dela serão removidas juntas.</span></div>
        <Button type="submit" className="submit-button">{purchase ? "Salvar em toda a sequência" : "Cadastrar parcelas"}</Button>
      </form>
    </DialogContent></Dialog>
  );
}

export function FinanceDashboard({ userName }: { userName: string }) {
  const router = useRouter();
  const loadRequestRef = useRef(0);
  const saveLockRef = useRef(false);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [bills, setBills] = useState<Bill[]>([]);
  const [cards, setCards] = useState<FinanceCard[]>([]);
  const [loans, setLoans] = useState<LoanInstallment[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [history, setHistory] = useState<MonthHistory[]>([]);
  const [investments, setInvestments] = useState<Investment[]>([]);
  const [investmentTotal, setInvestmentTotal] = useState(0);
  const [summary, setSummary] = useState<FinanceSummary>(emptySummary);
  const [syncState, setSyncState] = useState<"loading" | "ready" | "error">("loading");
  const [activeNav, setActiveNav] = useState<View>("Visão geral");
  const [month, setMonth] = useState(currentMonthKey());
  const monthRef = useRef(month);
  const [query, setQuery] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogTab, setDialogTab] = useState<EntryTab>("income");
  const [editingBill, setEditingBill] = useState<Bill | null>(null);
  const [editingCard, setEditingCard] = useState<FinanceCard | null>(null);
  const [editingIncome, setEditingIncome] = useState<Transaction | null>(null);
  const [editingInvestment, setEditingInvestment] = useState<Investment | null>(null);
  const [editingExpense, setEditingExpense] = useState<Transaction | null>(null);
  const [purchaseDialog, setPurchaseDialog] = useState<{ card: FinanceCard; purchase?: CardPurchase } | null>(null);
  const [simpleDeleteTarget, setSimpleDeleteTarget] = useState<SimpleDeleteTarget | null>(null);
  const [incomeDeleteTarget, setIncomeDeleteTarget] = useState<Transaction | null>(null);
  const [billDeleteTarget, setBillDeleteTarget] = useState<Bill | null>(null);
  const [cardBillActionTarget, setCardBillActionTarget] = useState<Bill | null>(null);
  const [billSort, setBillSort] = useState<"alpha" | "high" | "low">("alpha");
  const [commitmentFilter, setCommitmentFilter] = useState<"all" | "bills" | "incidental" | "cards" | "credit">("all");

  const loadData = useCallback(async (targetMonth = month) => {
    const requestId = ++loadRequestRef.current;
    setSyncState("loading");
    try {
      const response = await fetch("/api/finance?month=" + targetMonth, { cache: "no-store" });
      const data = await response.json() as {
        error?: string;
        transactions: Transaction[];
        bills: Bill[];
        cards: FinanceCard[];
        loans: LoanInstallment[];
        payments: Payment[];
        history: MonthHistory[];
        summary: FinanceSummary;
        investments: Investment[];
        investmentTotal: number;
      };
      if (!response.ok) throw new Error(data.error || "Não foi possível carregar seus dados.");
      if (requestId !== loadRequestRef.current) return;
      setTransactions(data.transactions);
      setBills(data.bills);
      setCards(data.cards);
      setLoans(data.loans);
      setPayments(data.payments);
      setHistory(data.history);
      setSummary(data.summary);
      setInvestments(data.investments);
      setInvestmentTotal(data.investmentTotal);
      setSyncState("ready");
    } catch (error) {
      if (requestId !== loadRequestRef.current) return;
      setSyncState("error");
      toast.error(error instanceof Error ? error.message : "Não foi possível carregar seus dados.");
    }
  }, [month]);

  useEffect(() => {
    const timer = window.setTimeout(() => { void loadData(month); }, 0);
    return () => window.clearTimeout(timer);
  }, [loadData, month]);

  async function save(payload: Record<string, unknown>, success: string) {
    if (saveLockRef.current) {
      toast.info("Aguarde a operação atual terminar.");
      return false;
    }
    saveLockRef.current = true;
    try {
      const response = await fetch("/api/finance", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await response.json() as { error?: string };
      if (!response.ok) throw new Error(data.error || "Não foi possível salvar.");
      await loadData(monthRef.current);
      toast.success(success);
      return true;
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível salvar.");
      return false;
    } finally {
      saveLockRef.current = false;
    }
  }

  async function signOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.replace("/auth");
    router.refresh();
  }

  function openEntry(tab: EntryTab) {
    setDialogTab(tab);
    setDialogOpen(true);
  }

  function selectNav(view: View) {
    setActiveNav(view);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function selectMonth(nextMonth: string) {
    if (!nextMonth || nextMonth === month) return;
    monthRef.current = nextMonth;
    setSyncState("loading");
    setTransactions([]);
    setBills([]);
    setCards([]);
    setLoans([]);
    setPayments([]);
    setHistory([]);
    setSummary(emptySummary);
    setMonth(nextMonth);
  }

  function changeMonth(offset: number) {
    selectMonth(shiftMonth(month, offset));
  }

  function requestSimpleDelete(target: SimpleDeleteTarget) {
    setSimpleDeleteTarget(target);
  }

  async function confirmSimpleDelete() {
    if (!simpleDeleteTarget) return;
    if (await save({ action: simpleDeleteTarget.action, id: simpleDeleteTarget.id }, simpleDeleteTarget.success)) {
      setSimpleDeleteTarget(null);
    }
  }

  async function deleteBill(scope: "current" | "sequence") {
    if (!billDeleteTarget) return;
    if (await save({ action: "delete_bill", id: billDeleteTarget.id, scope }, scope === "sequence" ? "Conta removida de todos os meses" : "Conta removida deste mês")) {
      setBillDeleteTarget(null);
    }
  }

  async function deleteIncome(scope: "current" | "sequence") {
    if (!incomeDeleteTarget) return;
    if (await save(
      { action: "delete_transaction", id: incomeDeleteTarget.id, scope },
      scope === "sequence" ? "Renda removida de todos os meses" : "Renda removida deste mês",
    )) {
      setIncomeDeleteTarget(null);
    }
  }

  function toggleCardBill(bill: Bill, reopenInvoice = false) {
    const message = bill.cardTransferred ? "Conta retirada da fatura" : "Conta incluída na fatura de " + monthLabel(bill.paymentMonth);
    void save({ action: "toggle_bill", id: bill.id, reopenInvoice }, message);
  }

  function requestCardBillToggle(bill: Bill) {
    if (bill.cardInvoicePaid) setCardBillActionTarget(bill);
    else toggleCardBill(bill);
  }

  const incomeItems = transactions.filter((item) => item.type === "income");
  const pendingIncomes = incomeItems.filter((item) => !item.paid);
  const expenseItems = transactions.filter((item) => item.type === "expense");
  const filteredPayments = payments.filter((item) => (item.title + " " + item.category).toLowerCase().includes(query.toLowerCase()));
  const commitmentPercent = summary.income > 0 ? Math.round(summary.committed / summary.income * 100) : 0;
  const commitmentRingPercent = Math.min(100, commitmentPercent);
  const commitmentTone = commitmentPercent > 100 ? "over-limit" : commitmentPercent === 100 ? "at-limit" : "under-limit";
  const forecastTone = summary.availableForecast < 0 ? "negative" : summary.availableForecast === 0 ? "zero" : "positive";
  const realizedTone = summary.availableRealized < 0 ? "negative" : summary.availableRealized === 0 ? "zero" : "positive";
  const availablePerDay = Math.max(0, summary.availableForecast / 30);
  const firstUse = syncState === "ready" && transactions.length === 0 && bills.length === 0 && cards.length === 0 && loans.length === 0;
  const hasChartData = summary.income > 0 || summary.committed > 0;
  const maxBar = Math.max(summary.incidental, summary.bills, summary.cards, summary.credit, 1);
  const maxHistory = Math.max(...history.map((item) => item.total), 1);
  const sortedBills = [...bills].sort((a, b) => billSort === "high" ? b.amount - a.amount : billSort === "low" ? a.amount - b.amount : a.title.localeCompare(b.title, "pt-BR"));
  const commitmentValues = {
    all: summary.committed,
    bills: summary.bills,
    incidental: summary.incidental,
    cards: summary.cards,
    credit: summary.credit,
  };
  const commitmentLabels = { all: "Tudo no mês", bills: "Contas mensais", incidental: "Gastos avulsos", cards: "Cartões", credit: "Créditos" };

  return (
    <SidebarProvider style={{ "--sidebar-width": "238px" } as React.CSSProperties}>
      <Sidebar variant="floating" collapsible="none" className="finance-sidebar">
        <SidebarHeader className="sidebar-brand">
          <div className="brand-mark"><WalletCards size={21} /></div>
          <div><strong>Simplifica</strong><span>CONTAS</span></div>
        </SidebarHeader>
        <SidebarContent>
          <SidebarGroup><SidebarGroupContent><SidebarMenu className="finance-menu">
            {navItems.map((item) => (
              <SidebarMenuItem key={item.label}>
                <SidebarMenuButton isActive={activeNav === item.label} onClick={() => selectNav(item.label)} tooltip={item.label}>
                  <item.icon /><span>{item.label}</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            ))}
          </SidebarMenu></SidebarGroupContent></SidebarGroup>
          <div className="sidebar-ad">
            <span>SIMPLIFICA+</span><Gift size={24} />
            <strong>Mais foco, sem anúncios.</strong>
            <p>O espaço do plano gratuito fica separado dos seus dados.</p>
            <button onClick={() => toast.info("O plano Simplifica+ será disponibilizado futuramente.")}>Conhecer o Plus <ArrowRight size={14} /></button>
          </div>
        </SidebarContent>
        <SidebarFooter className="sidebar-footer">
          <button onClick={() => toast.info("Cadastre primeiro sua renda, depois contas fixas e faturas. Os cálculos são automáticos.")}><HelpCircle size={18} /><span>Como começar</span></button>
          <button type="button" onClick={() => void signOut()}><LogOut size={17} /> Sair</button>
          <div className="user-mini"><span>{userName.slice(0, 2).toUpperCase()}</span><div><strong>{userName}</strong><small>Plano gratuito</small></div></div>
        </SidebarFooter>
      </Sidebar>

      <SidebarInset className="dashboard-shell">
        <header className="topbar">
          <div className="mobile-brand"><div className="brand-mark"><WalletCards size={18} /></div><strong>Simplifica</strong></div>
          <div className="greeting"><span>Olá, {userName}</span><strong>Seu dinheiro, explicado de forma simples.</strong></div>
          <div className="top-actions">
            <Button className="new-entry-button" onClick={() => openEntry("income")}><Plus size={17} /> Adicionar</Button>
          </div>
        </header>

        <main className="dashboard-content" data-view={activeNav}>
          {syncState === "error" && (
            <div className="sync-error"><HelpCircle size={15} /><span>Não foi possível sincronizar seus dados.</span><button onClick={() => void loadData()}>Tentar novamente</button></div>
          )}

          {activeNav !== "Investimentos" && <section className="period-navigation" aria-label="Escolher mês do painel">
            <button className="period-arrow" onClick={() => changeMonth(-1)} aria-label="Ir para o mês anterior"><ChevronLeft size={22} /></button>
            <label>
              <span>Período selecionado</span>
              <strong>{monthLabel(month)}</strong>
              <input type="month" value={month} onChange={(event) => selectMonth(event.target.value)} aria-label="Selecionar mês e ano" />
            </label>
            <button className="period-arrow" onClick={() => changeMonth(1)} aria-label="Ir para o próximo mês"><ChevronRight size={22} /></button>
            {month !== currentMonthKey() && <button className="period-today" onClick={() => selectMonth(currentMonthKey())}><CalendarDays size={15} /><span>Voltar para o mês atual</span></button>}
          </section>}

          {activeNav !== "Visão geral" && (
            <div className="view-heading">
              <div><span>SIMPLIFICA CONTAS</span><h1>{activeNav}</h1></div>
              <Button onClick={() => openEntry(activeNav === "Cartões" ? "card" : activeNav === "Contas do mês" ? "bill" : activeNav === "Investimentos" ? "investment" : "expense")}><Plus size={15} /> Adicionar</Button>
            </div>
          )}

          {activeNav === "Investimentos" && (
            <section className="investments-view" aria-label="Investimentos informados">
              <article className="investment-total-card">
                <div className="investment-total-icon"><PiggyBank size={27} /></div>
                <div><span>Patrimônio informado</span><strong>{currency.format(investmentTotal)}</strong><small>Soma dos valores atuais cadastrados</small></div>
                <button onClick={() => openEntry("investment")}><Plus size={15} /> Novo investimento</button>
              </article>

              <section className="glass-panel investments-panel">
                <div className="panel-heading"><div><span>Valores atuais</span><h2>Onde seu dinheiro está investido</h2></div><button className="text-link" onClick={() => openEntry("investment")}><Plus size={14} /> Investimento</button></div>
                <p className="investments-note"><ShieldCheck size={15} /> Esta área é somente informativa. Os valores não alteram renda, saldo ou compromissos mensais.</p>
                {investments.length ? (
                  <div className="investments-grid">
                    {investments.map((investment) => (
                      <article key={investment.id} className="investment-card">
                        <span className="investment-bank-icon"><Building2 size={20} /></span>
                        <div><span>Instituição</span><strong>{investment.institution}</strong></div>
                        <b>{currency.format(investment.amount)}</b>
                        <div className="investment-actions">
                          <button onClick={() => setEditingInvestment(investment)} aria-label={"Editar investimento em " + investment.institution}><Pencil size={14} /></button>
                          <button onClick={() => requestSimpleDelete({
                            action: "delete_investment",
                            id: investment.id,
                            title: "Excluir investimento em " + investment.institution + "?",
                            description: "O valor informado para esta instituição será removido. Seus cálculos financeiros mensais não serão alterados.",
                            success: "Investimento excluído",
                          })} aria-label={"Excluir investimento em " + investment.institution}><Trash2 size={14} /></button>
                        </div>
                      </article>
                    ))}
                  </div>
                ) : (
                  <EmptyState icon={PiggyBank} title="Nenhum investimento informado" copy="Cadastre o banco ou instituição e o valor atual. Você poderá editar esse saldo quando quiser." action="Cadastrar investimento" onAction={() => openEntry("investment")} />
                )}
              </section>
            </section>
          )}

          {activeNav === "Visão geral" && firstUse && (
            <section className="first-use">
              <div className="first-use-copy"><span>PRIMEIROS PASSOS</span><h1>Vamos organizar este mês?</h1><p>Comece pela sua renda. Depois adicione contas mensais, gastos e cartões. Você pode voltar e ajustar tudo quando quiser.</p></div>
              <div className="setup-steps">
                <button onClick={() => openEntry("income")}><span>1</span><div><strong>Adicionar minha renda</strong><small>Uma ou várias fontes</small></div><ArrowRight size={17} /></button>
                <button onClick={() => openEntry("bill")}><span>2</span><div><strong>Cadastrar contas mensais</strong><small>Para 1, 6 ou 12 meses</small></div><ArrowRight size={17} /></button>
                <button onClick={() => openEntry("card")}><span>3</span><div><strong>Adicionar um cartão</strong><small>Banco, vencimento e faturas mensais</small></div><ArrowRight size={17} /></button>
              </div>
            </section>
          )}

          {activeNav === "Visão geral" && (
            <>
              <section className="summary-grid" aria-label="Resumo do mês">
                <article className={"summary-card primary " + forecastTone}>
                  <div className="summary-heading"><span>Saldo previsto</span><CircleDollarSign size={18} /></div>
                  <strong>{currency.format(summary.availableForecast)}</strong>
                  <p>{summary.availableForecast > 0 ? "Renda prevista menos tudo do mês" : summary.availableForecast === 0 ? "Sua renda prevista está totalmente comprometida" : "Os compromissos passaram da renda prevista"}</p>
                  <div className="balance-orbit" />
                </article>
                <article className={"summary-card realized-card " + realizedTone}>
                  <div className="summary-heading"><span>Saldo realizado</span><ShieldCheck size={18} /></div>
                  <strong>{currency.format(summary.availableRealized)}</strong>
                  <p className="muted-line">Recebido menos o que já foi pago</p>
                </article>
                <article className="summary-card income-summary">
                  <div className="summary-heading"><span>Renda prevista no mês</span><Banknote size={18} /></div>
                  <strong>{currency.format(summary.income)}</strong>
                  <p className="muted-line">{incomeItems.length - pendingIncomes.length} de {incomeItems.length} renda{incomeItems.length === 1 ? "" : "s"} recebida{incomeItems.length === 1 ? "" : "s"}</p>
                </article>
                <article className="summary-card commitment-summary">
                  <div className="summary-heading"><span>Total comprometido</span><WalletCards size={18} /></div>
                  <strong>{currency.format(commitmentValues[commitmentFilter])}</strong>
                  <Select value={commitmentFilter} onValueChange={(value) => setCommitmentFilter(value as typeof commitmentFilter)}>
                    <SelectTrigger className="commitment-filter" aria-label="Filtrar total comprometido"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Tudo no mês</SelectItem>
                      <SelectItem value="bills">Contas mensais</SelectItem>
                      <SelectItem value="incidental">Gastos avulsos</SelectItem>
                      <SelectItem value="cards">Cartões</SelectItem>
                      <SelectItem value="credit">Créditos</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="muted-line">Exibindo: {commitmentLabels[commitmentFilter]}</p>
                </article>
                <button type="button" className="summary-card investment-summary" onClick={() => selectNav("Investimentos")} aria-label={"Abrir investimentos. Total informado: " + currency.format(investmentTotal)}>
                  <div className="summary-heading"><span>Total investido</span><PiggyBank size={18} /></div>
                  <strong>{currency.format(investmentTotal)}</strong>
                  <p>{investments.length ? investments.length + " institui" + (investments.length === 1 ? "ção cadastrada" : "ções cadastradas") : "Cadastre onde seu dinheiro está investido"}</p>
                  <span className="summary-card-link">Ver investimentos <ArrowRight size={13} /></span>
                </button>
              </section>

              <section className={"insight-card " + forecastTone}>
                <div className="insight-icon"><Lightbulb size={20} /></div>
                <div><span>Resumo simples</span><strong>{summary.income === 0 ? "Cadastre sua renda para calcular quanto fica livre no mês." : summary.availableForecast > 0 ? "Depois de tudo que está previsto, ficam " + currency.format(summary.availableForecast) + " livres neste mês." : summary.availableForecast === 0 ? "Toda a renda prevista deste mês já está comprometida." : "Faltam " + currency.format(Math.abs(summary.availableForecast)) + " para cobrir todos os compromissos previstos."}</strong></div>
                {summary.availableForecast > 0 && <em>{currency.format(availablePerDay)} por dia</em>}
              </section>

              <details className={"calculation-audit glass-panel " + forecastTone}>
                <summary><Calculator size={16} /><span><strong>Conferir como chegamos neste saldo</strong><small>Veja cada valor somado e subtraído no mês</small></span><em className="calculation-status">{forecastTone === "negative" ? "Saldo negativo" : forecastTone === "zero" ? "Saldo zerado" : "Saldo positivo"}</em><ChevronRight size={16} /></summary>
                <div className="calculation-grid">
                  <div><span>Renda prevista</span><b>{currency.format(summary.income)}</b></div>
                  <div><span>Contas mensais</span><b>− {currency.format(summary.bills)}</b></div>
                  <div><span>Gastos avulsos</span><b>− {currency.format(summary.incidental)}</b></div>
                  <div><span>Faturas dos cartões</span><b>− {currency.format(summary.cards)}</b></div>
                  <div><span>Empréstimos e limite</span><b>− {currency.format(summary.credit)}</b></div>
                  <div className={"calculation-result " + forecastTone}><span>Saldo previsto</span><b>{currency.format(summary.availableForecast)}</b></div>
                  <div><span>Renda recebida</span><b>{currency.format(summary.receivedIncome)}</b></div>
                  <div><span>Valores já pagos</span><b>− {currency.format(summary.realizedOutflows)}</b></div>
                  <div className={"calculation-result " + realizedTone}><span>Saldo realizado</span><b>{currency.format(summary.availableRealized)}</b></div>
                </div>
                <p>Uma conta vinculada deixa de contar em “Contas mensais” quando é incluída na fatura, evitando que o mesmo valor seja descontado duas vezes.</p>
              </details>
            </>
          )}

          {activeNav === "Contas do mês" && (
            <section className="view-totals" aria-label="Totais das contas e gastos do mês">
              <article className="view-total-primary"><span>Total de contas e gastos avulsos</span><strong>{currency.format(summary.bills + summary.incidental)}</strong><small>Sem duplicar valores que já foram incluídos em cartões</small></article>
              <article><span>Contas mensais</span><strong>{currency.format(summary.bills)}</strong></article>
              <article><span>Gastos avulsos</span><strong>{currency.format(summary.incidental)}</strong></article>
            </section>
          )}

          {activeNav === "Cartões" && (
            <section className="view-totals" aria-label="Totais de cartões e créditos do mês">
              <article className="view-total-primary"><span>Total em cartões e créditos</span><strong>{currency.format(summary.cards + summary.credit)}</strong><small>Valores previstos para {monthLabel(month)}</small></article>
              <article><span>Faturas dos cartões</span><strong>{currency.format(summary.cards)}</strong></article>
              <article><span>Empréstimos e limite</span><strong>{currency.format(summary.credit)}</strong></article>
            </section>
          )}

          <div className="dashboard-columns">
            <div className="main-column">
              {activeNav === "Visão geral" && (
                <section className="glass-panel flow-panel">
                  <div className="panel-heading"><div><span>Visão do mês</span><h2>Para onde o dinheiro está indo</h2></div><div className="legend"><span className="income-dot" /> renda <span className="expense-dot" /> compromissos</div></div>
                  {hasChartData ? (
                    <div className="flow-figure">
                      <div className={"donut " + commitmentTone} style={{ "--value": commitmentRingPercent } as React.CSSProperties}><div><small>comprometido</small><strong>{commitmentPercent}%</strong></div></div>
                      <div className="flow-copy">
                        <div><span>Renda prevista</span><strong>{currency.format(summary.income)}</strong></div>
                        <div><span>Já recebido</span><strong>{currency.format(summary.receivedIncome)}</strong></div>
                        <div><span>Comprometido</span><strong>{currency.format(summary.committed)}</strong></div>
                        <p><ShieldCheck size={16} /> Gastos, contas, faturas e parcelas de crédito entram neste cálculo.</p>
                      </div>
                      <div className="real-bars" aria-label="Comparação dos compromissos">
                        {[["Avulsos", summary.incidental], ["Contas", summary.bills], ["Faturas", summary.cards], ["Créditos", summary.credit]].map(([label, value]) => (
                          <div key={String(label)}><span><i style={{ height: String(Number(value) / maxBar * 100) + "%" }} /></span><small>{label}<b>{currency.format(Number(value))}</b></small></div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="chart-empty"><Sparkles size={22} /><strong>Seu gráfico começa com seus dados</strong><p>Adicione uma renda, gasto, conta, fatura ou crédito para visualizar o mês.</p></div>
                  )}
                </section>
              )}

              {activeNav === "Visão geral" && (
                <section className="glass-panel history-panel">
                  <div className="panel-heading"><div><span>Últimos seis meses</span><h2>Quanto ficou comprometido em cada mês</h2></div><small>Gastos + contas + faturas + créditos</small></div>
                  <div className="month-history-navigation">
                    <button type="button" className="history-arrow" onClick={() => changeMonth(-6)} aria-label="Ver os seis meses anteriores"><ChevronLeft size={20} /></button>
                    <div className="month-towers">
                      {history.map((item) => (
                        <button key={item.month} type="button" className={item.month === month ? "current" : ""} onClick={() => { setMonth(item.month); window.scrollTo({ top: 0, behavior: "smooth" }); }} aria-label={"Abrir os dados de " + monthLabel(item.month)}>
                          <b>{currency.format(item.total)}</b>
                          <span><i style={{ height: item.total === 0 ? "3px" : String(Math.max(8, item.total / maxHistory * 100)) + "%" }} /></span>
                          <small>{monthLabel(item.month).split(" ")[0].slice(0, 3)}</small>
                        </button>
                      ))}
                    </div>
                    <button type="button" className="history-arrow" onClick={() => changeMonth(6)} aria-label="Ver os seis meses seguintes"><ChevronRight size={20} /></button>
                  </div>
                </section>
              )}

              {(activeNav === "Visão geral" || activeNav === "Movimentações") && (
                <section className="glass-panel income-panel">
                  <div className="panel-heading"><div><span>Rendas de {monthLabel(month)}</span><h2>Rendas previstas e recebidas</h2></div><button className="text-link" onClick={() => openEntry("income")}><Plus size={14} /> Renda</button></div>
                  {incomeItems.length > 0 && <div className="bill-toolbar"><span><MousePointerClick size={14} /> Confirme no ícone quando receber. A renda continuará visível aqui.</span></div>}
                  {incomeItems.length ? <div className="bill-list income-list">
                    {incomeItems.map((income) => <article key={income.id} className={income.paid ? "paid" : ""}>
                      <button className="bill-check income-check" onClick={() => void save({ action: "toggle_transaction", id: income.id }, income.paid ? "Renda voltou para prevista" : "Renda confirmada como recebida")} aria-label={income.paid ? "Voltar " + income.title + " para prevista" : "Confirmar recebimento de " + income.title}>{income.paid ? <Check size={14} /> : <Landmark size={16} />}</button>
                      <div><strong>{income.title}</strong><span>{income.paid ? "Recebida" : "Prevista"} para o dia {new Date(income.date).getUTCDate()}</span></div>
                      <b>{currency.format(income.amount)}</b>
                      <button className="row-edit" onClick={() => setEditingIncome(income)} aria-label={"Editar " + income.title}><Pencil size={14} /></button>
                      <button className="row-delete" onClick={() => setIncomeDeleteTarget(income)} aria-label={"Excluir " + income.title}><Trash2 size={14} /></button>
                    </article>)}
                  </div> : <EmptyState icon={Landmark} title="Nenhuma renda neste mês" copy="Cadastre uma ou mais fontes e confirme cada recebimento pelo próprio box." action="Cadastrar renda" onAction={() => openEntry("income")} />}
                </section>
              )}

              {(activeNav === "Visão geral" || activeNav === "Movimentações" || activeNav === "Contas do mês") && (
                <div className="obligations-grid">
                  {(activeNav === "Visão geral" || activeNav === "Movimentações" || activeNav === "Contas do mês") && (
                    <section className="glass-panel bills-panel">
                      <div className="panel-heading"><div><span>Recorrentes em {monthLabel(month)}</span><h2>Contas mensais</h2></div><button className="text-link" onClick={() => openEntry("bill")}><Plus size={14} /> Conta</button></div>
                      {bills.length > 0 && <div className="bill-toolbar"><span><MousePointerClick size={14} /> Contas diretas são pagas pelo ícone. Para contas de cartão, use o botão “Incluir na fatura”.</span><Select value={billSort} onValueChange={(value) => setBillSort(value as "alpha" | "high" | "low")}><SelectTrigger aria-label="Ordenar contas"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="alpha">Ordem alfabética</SelectItem><SelectItem value="high">Maior valor primeiro</SelectItem><SelectItem value="low">Menor valor primeiro</SelectItem></SelectContent></Select></div>}
                      {bills.length ? (
                        <div className="bill-list">
                          {sortedBills.map((bill) => {
                            const BillIcon = billIcon(bill.icon);
                            const cardStatus = bill.paymentMethod === "card" && (bill.paid ? "Paga na fatura " + bill.cardName + " de " + monthLabel(bill.paymentMonth) : bill.cardTransferred ? "Incluída na fatura " + bill.cardName + " de " + monthLabel(bill.paymentMonth) : "Prevista no " + bill.cardName + " para " + monthLabel(bill.paymentMonth));
                            return (
                            <article key={bill.id} className={(bill.paymentMethod === "card" ? "card-bill-row " : "") + (bill.paid ? "paid" : bill.cardTransferred ? "transferred" : "")}>
                              {bill.paymentMethod === "card" ? <span className={"bill-check card-check card-status-icon " + (bill.paid ? "invoice-paid" : bill.cardTransferred ? "invoice-linked" : "invoice-planned")} aria-hidden="true">{bill.paid ? <Check size={14} /> : <CreditCard size={16} />}</span> : <button className="bill-check" title={bill.paid ? "Clique para voltar a pendente" : "Clique para marcar como paga"} onClick={() => void save({ action: "toggle_bill", id: bill.id }, bill.paid ? "Conta marcada como pendente" : "Conta marcada como paga")} aria-label={bill.paid ? "Marcar " + bill.title + " como pendente" : "Marcar " + bill.title + " como paga"}>{bill.paid ? <Check size={14} /> : <BillIcon size={16} />}</button>}
                              <div className="bill-copy"><strong>{bill.title}</strong><span>{cardStatus || bill.category + " · vence dia " + bill.dueDay}{bill.recurrenceId ? " · recorrente" : ""}</span></div>
                              <b>{currency.format(bill.amount)}</b>
                              {bill.paymentMethod === "card" && <button className={"card-bill-action " + (bill.paid ? "paid" : bill.cardTransferred ? "linked" : "planned")} onClick={() => requestCardBillToggle(bill)}>{bill.paid ? "Desfazer" : bill.cardTransferred ? "Retirar da fatura" : "Incluir na fatura"}</button>}
                              <button className="row-edit" onClick={() => setEditingBill(bill)} aria-label={"Editar " + bill.title}><Pencil size={14} /></button>
                              <button className="row-delete" onClick={() => setBillDeleteTarget(bill)} aria-label={"Excluir " + bill.title}><Trash2 size={14} /></button>
                            </article>
                          )})}
                        </div>
                      ) : (
                        <EmptyState icon={CalendarDays} title="Nenhuma conta neste mês" copy="Cadastre uma conta somente para este mês ou repita por 6 ou 12 meses." action="Cadastrar conta mensal" onAction={() => openEntry("bill")} />
                      )}
                    </section>
                  )}

                  {(activeNav === "Visão geral" || activeNav === "Movimentações" || activeNav === "Contas do mês") && (
                    <section className="glass-panel pending-expenses-panel">
                      <div className="panel-heading"><div><span>Gastos de {monthLabel(month)}</span><h2>Gastos avulsos do mês</h2></div><button className="text-link" onClick={() => openEntry("expense")}><Plus size={14} /> Gasto</button></div>
                      {expenseItems.length > 0 && <div className="bill-toolbar"><span><MousePointerClick size={14} /> Marque o pagamento no ícone. O gasto continuará visível aqui.</span></div>}
                      {expenseItems.length ? <div className="bill-list expense-list">
                        {expenseItems.map((expense) => {
                          const ExpenseIcon = transactionIcon(expense);
                          return <article key={expense.id} className={expense.paid ? "paid" : ""}>
                            <button className="bill-check expense-check" onClick={() => void save({ action: "toggle_transaction", id: expense.id }, expense.paid ? "Gasto voltou para pendente" : "Gasto marcado como pago")} aria-label={expense.paid ? "Voltar " + expense.title + " para pendente" : "Marcar " + expense.title + " como pago"}>{expense.paid ? <Check size={14} /> : <ExpenseIcon size={16} />}</button>
                            <div><strong>{expense.title}</strong><span>{expense.category} · {expense.paid ? "pago" : "pendente"} · dia {new Date(expense.date).getUTCDate()}</span></div>
                            <b>{currency.format(expense.amount)}</b>
                            <button className="row-edit" onClick={() => setEditingExpense(expense)} aria-label={"Editar " + expense.title}><Pencil size={14} /></button>
                            <button className="row-delete" onClick={() => requestSimpleDelete({
                              action: "delete_transaction",
                              id: expense.id,
                              title: "Excluir " + expense.title + "?",
                              description: "Somente este gasto avulso de " + monthLabel(month) + " será removido.",
                              success: "Gasto excluído",
                            })} aria-label={"Excluir " + expense.title}><Trash2 size={14} /></button>
                          </article>;
                        })}
                      </div> : <EmptyState icon={ShoppingBag} title="Nenhum gasto neste mês" copy="Cadastre um gasto avulso e acompanhe o pagamento neste mesmo box." action="Cadastrar gasto" onAction={() => openEntry("expense")} />}
                    </section>
                  )}
                </div>
              )}

              {(activeNav === "Visão geral" || activeNav === "Movimentações") && (
                <section className="glass-panel activity-panel">
                  <div className="panel-heading"><div><span>Movimentações de {monthLabel(month)}</span><h2>{activeNav === "Movimentações" ? "Histórico completo do mês" : "Atividade do mês"}</h2></div>{activeNav === "Visão geral" && <button className="text-link" onClick={() => selectNav("Movimentações")}>Ver tudo <ArrowRight size={14} /></button>}</div>
                  {activeNav === "Movimentações" && <label className="search-field"><Search size={16} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar no histórico" /></label>}
                  {filteredPayments.length ? (
                    <div className="transaction-list payment-history">
                      {filteredPayments.slice(0, activeNav === "Visão geral" ? 8 : 250).map((item) => {
                        const Icon = paymentIcon(item);
                        const confirmed = item.status === "received" || item.status === "paid" || item.status === "card_paid";
                        const cardDetail = item.sourceType === "bill" && (item.status === "card_linked" || item.status === "card_paid" || item.status === "card_planned");
                        const StatusIcon = confirmed ? Check : item.status === "card_linked" || item.status === "card_planned" ? CreditCard : Clock3;
                        const statusLabel = item.status === "received" ? "Recebida" : item.status === "paid" ? "Pago" : item.status === "card_paid" ? "Pago no cartão" : item.status === "card_linked" ? "Na fatura" : item.status === "card_planned" ? "Prevista no cartão" : "Pendente";
                        return (
                          <article key={item.id}>
                            <span className={"transaction-icon " + item.type}><Icon size={17} /></span>
                            <div><strong>{item.title}</strong><span>{item.category} · {dateFormatter.format(new Date(item.date))}</span></div>
                            <b className={item.type + (cardDetail ? " card-detail" : "")}>{item.type === "income" ? "+" : cardDetail ? "↳" : "−"} {currency.format(item.amount)}</b>
                            <span className={"activity-status " + item.status} aria-label={statusLabel} title={statusLabel}><StatusIcon size={14} /></span>
                          </article>
                        );
                      })}
                    </div>
                  ) : (
                    <EmptyState icon={ReceiptText} title="Nenhuma movimentação neste mês" copy="Rendas, gastos, contas, faturas e créditos aparecerão aqui com seus respectivos estados." />
                  )}
                </section>
              )}
            </div>

            <aside className="side-column">
              {(activeNav === "Visão geral" || activeNav === "Cartões") && (
                <section className="glass-panel credit-card-panel">
                  <div className="panel-heading"><div><span>Valores de {monthLabel(month)}</span><h2>Cartões de crédito</h2></div><button className="text-link" onClick={() => openEntry("card")}><Plus size={14} /> Cartão</button></div>
                  {cards.length ? <div className="cards-editor-grid">{cards.map((card) => (
                    <InvoiceEditor
                      key={[card.id, month, card.managementMode, card.invoice].join("-")}
                      card={card}
                      month={month}
                      save={save}
                      edit={() => setEditingCard(card)}
                      remove={() => requestSimpleDelete({
                        action: "delete_card",
                        id: card.id,
                        title: "Excluir o cartão " + card.bank + "?",
                        description: "As faturas e todas as compras parceladas deste cartão serão apagadas. Contas mensais vinculadas voltarão para pagamento direto.",
                        success: "Cartão excluído",
                      })}
                      addPurchase={() => setPurchaseDialog({ card })}
                      editPurchase={(purchase) => setPurchaseDialog({ card, purchase })}
                      removePurchase={(purchase) => requestSimpleDelete({
                        action: "delete_card_purchase",
                        id: purchase.id,
                        title: "Excluir " + purchase.title + "?",
                        description: "Todas as parcelas passadas e futuras desta compra serão removidas.",
                        success: "Compra parcelada excluída",
                      })}
                    />
                  ))}</div> : (
                    <EmptyState icon={CreditCard} title="Nenhum cartão cadastrado" copy="Cadastre somente banco e vencimento; depois escolha entre total mensal ou compras parceladas." action="Adicionar cartão" onAction={() => openEntry("card")} />
                  )}
                </section>
              )}

              {(activeNav === "Visão geral" || activeNav === "Cartões") && (
                <section className="glass-panel loans-panel">
                  <div className="panel-heading"><div><span>Parcelas de {monthLabel(month)}</span><h2>Empréstimos e limite bancário</h2></div><button className="text-link" onClick={() => openEntry("loan")}><Plus size={14} /> Crédito</button></div>
                  {loans.length > 0 && <div className="bill-toolbar"><span><MousePointerClick size={14} /> Cada parcela ocupa um mês. Ao excluir, toda a sequência é removida.</span></div>}
                  {loans.length ? <div className="bill-list loan-list">
                    {loans.map((loan) => <article key={loan.id} className={loan.paid ? "paid" : ""}>
                      <button className="bill-check loan-check" onClick={() => void save({ action: "toggle_loan", id: loan.id }, loan.paid ? "Parcela voltou para pendente" : "Parcela marcada como paga")} aria-label={loan.paid ? "Voltar parcela para pendente" : "Marcar parcela como paga"}>{loan.paid ? <Check size={14} /> : <HandCoins size={16} />}</button>
                      <div><strong>{loan.title}</strong><span>{loan.kind === "bank_limit" ? "Limite bancário" : "Empréstimo"} · parcela {loan.installmentNumber}/{loan.installmentCount}</span></div>
                      <b>{currency.format(loan.amount)}</b>
                      <span className="row-spacer" />
                      <button className="row-delete" onClick={() => requestSimpleDelete({
                        action: "delete_loan",
                        id: loan.id,
                        title: "Excluir " + loan.title + "?",
                        description: "Todas as parcelas passadas e futuras desta sequência serão removidas.",
                        success: "Crédito parcelado excluído",
                      })} aria-label={"Excluir todas as parcelas de " + loan.title}><Trash2 size={14} /></button>
                    </article>)}
                  </div> : <EmptyState icon={HandCoins} title="Nenhum crédito parcelado" copy="Cadastre empréstimos ou uso de limite para enxergar as parcelas dos próximos meses." action="Cadastrar crédito" onAction={() => openEntry("loan")} />}
                </section>
              )}

              {activeNav === "Visão geral" && (
                <section className="ad-slot" aria-label="Espaço publicitário"><span>PUBLICIDADE</span><div><Sparkles size={19} /><p><strong>Espaço para parceiro</strong>Anúncios ficam sempre separados dos seus dados financeiros.</p></div></section>
              )}
            </aside>
          </div>
        </main>

        <nav className="mobile-nav" aria-label="Navegação principal">
          {navItems.slice(0, 2).map((item) => <button key={item.label} className={activeNav === item.label ? "active" : ""} onClick={() => selectNav(item.label)}><item.icon size={20} /><span>{item.label === "Visão geral" ? "Início" : "Lançamentos"}</span></button>)}
          <button className="mobile-add" onClick={() => openEntry("income")} aria-label="Adicionar"><Plus size={24} /></button>
          {navItems.slice(2, 4).map((item) => <button key={item.label} className={activeNav === item.label ? "active" : ""} onClick={() => selectNav(item.label)}><item.icon size={20} /><span>{item.label.replace(" do mês", "")}</span></button>)}
        </nav>

        <EntryDialog open={dialogOpen} setOpen={setDialogOpen} tab={dialogTab} setTab={setDialogTab} month={month} cards={cards} save={save} />
        <BillEditDialog key={editingBill?.id || "no-bill"} bill={editingBill} open={Boolean(editingBill)} setOpen={(open) => { if (!open) setEditingBill(null); }} cards={cards} save={save} />
        <CardEditDialog card={editingCard} open={Boolean(editingCard)} setOpen={(open) => { if (!open) setEditingCard(null); }} save={save} />
        <IncomeEditDialog income={editingIncome} open={Boolean(editingIncome)} setOpen={(open) => { if (!open) setEditingIncome(null); }} save={save} />
        <InvestmentEditDialog investment={editingInvestment} open={Boolean(editingInvestment)} setOpen={(open) => { if (!open) setEditingInvestment(null); }} save={save} />
        <ExpenseEditDialog expense={editingExpense} open={Boolean(editingExpense)} setOpen={(open) => { if (!open) setEditingExpense(null); }} save={save} />
        <CardPurchaseDialog data={purchaseDialog} month={month} setOpen={(open) => { if (!open) setPurchaseDialog(null); }} save={save} />
        <AlertDialog open={Boolean(simpleDeleteTarget)} onOpenChange={(open) => { if (!open) setSimpleDeleteTarget(null); }}>
          <AlertDialogContent className="entry-dialog delete-dialog">
            <AlertDialogHeader>
              <AlertDialogTitle>{simpleDeleteTarget?.title}</AlertDialogTitle>
              <AlertDialogDescription>{simpleDeleteTarget?.description}</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <Button type="button" variant="destructive" onClick={() => void confirmSimpleDelete()}>Excluir</Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
        <AlertDialog open={Boolean(cardBillActionTarget)} onOpenChange={(open) => { if (!open) setCardBillActionTarget(null); }}>
          <AlertDialogContent className="entry-dialog delete-dialog">
            <AlertDialogHeader><AlertDialogTitle>Reabrir a fatura de {cardBillActionTarget ? monthLabel(cardBillActionTarget.paymentMonth) : "este mês"}?</AlertDialogTitle><AlertDialogDescription>A fatura {cardBillActionTarget?.cardName} está marcada como paga. Para {cardBillActionTarget?.cardTransferred ? "retirar" : "incluir"} {cardBillActionTarget?.title}, ela voltará para pendente e poderá ser conferida novamente.</AlertDialogDescription></AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction variant="outline" onClick={() => { if (cardBillActionTarget) toggleCardBill(cardBillActionTarget, true); }}>Reabrir fatura e continuar</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
        <AlertDialog open={Boolean(incomeDeleteTarget)} onOpenChange={(open) => { if (!open) setIncomeDeleteTarget(null); }}>
          <AlertDialogContent className="entry-dialog delete-dialog">
            <AlertDialogHeader><AlertDialogTitle>Excluir {incomeDeleteTarget?.title}?</AlertDialogTitle><AlertDialogDescription>{incomeDeleteTarget?.recurrenceId ? "Escolha se deseja apagar apenas a renda deste mês ou toda a sequência recorrente." : "Esta renda existe somente neste mês."}</AlertDialogDescription></AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <Button type="button" variant="outline" onClick={() => void deleteIncome("current")}>{incomeDeleteTarget?.recurrenceId ? "Somente deste mês" : "Excluir renda"}</Button>
              {incomeDeleteTarget?.recurrenceId && <Button type="button" variant="destructive" onClick={() => void deleteIncome("sequence")}>Toda a sequência</Button>}
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
        <AlertDialog open={Boolean(billDeleteTarget)} onOpenChange={(open) => { if (!open) setBillDeleteTarget(null); }}>
          <AlertDialogContent className="entry-dialog delete-dialog">
            <AlertDialogHeader><AlertDialogTitle>Excluir {billDeleteTarget?.title}?</AlertDialogTitle><AlertDialogDescription>{billDeleteTarget?.recurrenceId ? "Escolha se deseja apagar apenas a conta deste mês ou toda a sequência recorrente." : "Esta conta existe somente neste mês."}</AlertDialogDescription></AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <Button type="button" variant="outline" onClick={() => void deleteBill("current")}>{billDeleteTarget?.recurrenceId ? "Somente deste mês" : "Excluir conta"}</Button>
              {billDeleteTarget?.recurrenceId && <Button type="button" variant="destructive" onClick={() => void deleteBill("sequence")}>Toda a sequência</Button>}
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </SidebarInset>
      <Toaster position="top-right" richColors />
    </SidebarProvider>
  );
}
