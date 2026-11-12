import type { components } from "@/api/schema.gen";
import type { MessageKey } from "@/i18n/catalog.en";
import type { TFunction } from "@/i18n/i18n-provider";

type Transaction = components["schemas"]["Transaction"];

export interface TitleContext {
  payee?: string | undefined;
  // Accounts by id: the holding account of an income carries the instrument code.
  accounts?: ReadonlyMap<string, { currency: string }> | undefined;
}

const tradeKeys = {
  buy: "transactions.title.buy",
  sell: "transactions.title.sell",
} satisfies Record<components["schemas"]["TradeSide"], MessageKey>;

// The payee, else the description, else a title from the trade or the income the transaction
// records; empty when none exists, and the caller names the untitled entry.
export function transactionTitle(
  tx: Transaction,
  t: TFunction,
  { payee, accounts }: TitleContext = {},
): string {
  if (payee !== undefined) return payee;
  if (tx.description !== "") return tx.description;

  if (tx.trade !== undefined) {
    return t(tradeKeys[tx.trade.side], { code: tx.trade.quantity.currency });
  }

  const code =
    tx.investment_income === undefined
      ? undefined
      : accounts?.get(tx.investment_income.account_id)?.currency;

  return code === undefined ? "" : t("transactions.title.income", { code });
}
