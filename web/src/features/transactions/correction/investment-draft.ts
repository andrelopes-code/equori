import type { components } from "@/api/schema.gen";
import { formatRate } from "@/features/instruments";
import type { IncomeDraft } from "@/features/transactions/income-entry/income-draft";
import type { TradeDraft } from "@/features/transactions/trade-entry/trade-draft";

type Account = components["schemas"]["Account"];
type Transaction = components["schemas"]["Transaction"];
type Posting = Transaction["postings"][number];
type Trade = components["schemas"]["Trade"];

// The trade form filled from a stored trade (A227 IC9); null for a transaction without one.
export function tradeDraftOf(
  tx: Transaction,
  accounts: readonly Account[],
  locale: string,
): TradeDraft | null {
  const trade = tx.trade;
  if (trade === undefined) return null;

  return {
    side: trade.side,
    brokerageId: parentOf(trade.account_id, accounts),
    instrument: trade.quantity.currency,
    cashAccountId: trade.cash_account_id,
    date: tx.date,
    settlementDate: trade.settlement_date,
    quantity: trade.quantity.amount,
    unitPrice: formatRate(trade.unit_price, locale),
    priceBasis: "unit",
    total: 0,
    fees: trade.fees.amount,
    taxes: trade.taxes.amount,
    taxesCategoryId: chosen(taxesAccount(tx.postings, trade), accounts),
    description: tx.description,
  };
}

// The income form filled from a stored income (A227 IC9); null for a transaction without one.
export function incomeDraftOf(
  tx: Transaction,
  accounts: readonly Account[],
): IncomeDraft | null {
  const income = tx.investment_income;
  if (income === undefined) return null;

  // IC11: BuildIncome posts cash and withheld positive, the income category negative.
  const withheld =
    income.withheld.amount > 0
      ? tx.postings.find(
          (p) => p.account_id !== income.cash_account_id && p.amount.amount > 0,
        )
      : undefined;

  return {
    brokerageId: parentOf(income.account_id, accounts),
    instrument:
      accounts.find((a) => a.id === income.account_id)?.currency ?? null,
    cashAccountId: income.cash_account_id,
    date: tx.date,
    incomeType: income.income_type,
    gross: income.gross.amount,
    withheld: income.withheld.amount,
    categoryId:
      tx.postings.find((p) => p.amount.amount < 0)?.account_id ?? null,
    withheldCategoryId: chosen(withheld?.account_id ?? null, accounts),
    description: tx.description,
  };
}

function parentOf(id: string, accounts: readonly Account[]): string | null {
  return accounts.find((a) => a.id === id)?.parent_id ?? null;
}

// IC11: sellPostings places the taxes before the security posting and a loss after it.
function taxesAccount(
  postings: readonly Posting[],
  trade: Trade,
): string | null {
  if (trade.taxes.amount === 0) return null;

  const security = postings.findIndex((p) => p.account_id === trade.account_id);
  const taxes = postings
    .slice(0, security)
    .find((p) => p.account_id !== trade.cash_account_id && p.amount.amount > 0);

  return taxes?.account_id ?? null;
}

// A system account is the server's default: the form leaves the category unset for it.
function chosen(
  id: string | null,
  accounts: readonly Account[],
): string | null {
  if (id === null) return null;

  return accounts.find((a) => a.id === id)?.system_role === undefined
    ? id
    : null;
}
