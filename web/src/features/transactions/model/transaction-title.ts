import type { components } from "@/api/schema.gen";
import type { MessageKey } from "@/i18n/catalog.en";
import type { TFunction } from "@/i18n/i18n-provider";
import { actionKindKeys } from "@/features/transactions/action-entry/action-kind";
import { postingsTitle } from "@/features/transactions/model/transaction-title-kinds";

type Account = components["schemas"]["Account"];
type Transaction = components["schemas"]["Transaction"];

export interface TitleContext {
  payee?: string | undefined;
  // Accounts by id: the holding account of an income carries the instrument code, and the
  // postings of the other kinds name their accounts and categories.
  accounts?: Map<string, Account> | undefined;
}

const tradeKeys = {
  buy: "transactions.title.buy",
  sell: "transactions.title.sell",
} satisfies Record<components["schemas"]["TradeSide"], MessageKey>;

// The payee, else the description, else a title from the trade, the income or the postings the
// transaction records; empty when none exists, and the caller names the untitled entry.
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

  if (tx.investment_income !== undefined) {
    const code = accounts?.get(tx.investment_income.account_id)?.currency;

    return code === undefined ? "" : t("transactions.title.income", { code });
  }

  if (tx.corporate_action !== undefined) {
    const code = accounts?.get(tx.corporate_action.account_id)?.currency;

    return code === undefined
      ? ""
      : t("transactions.title.action", {
          kind: t(actionKindKeys[tx.corporate_action.kind]),
          code,
        });
  }

  return accounts === undefined ? "" : postingsTitle(tx, t, accounts);
}
