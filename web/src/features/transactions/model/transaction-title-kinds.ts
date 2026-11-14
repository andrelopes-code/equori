import type { components } from "@/api/schema.gen";
import type { MessageKey } from "@/i18n/catalog.en";
import type { TFunction } from "@/i18n/i18n-provider";
import { rowAmount } from "@/features/transactions/model/row-amount";
import { transactionRow } from "@/features/transactions/model/transaction-row";

type Account = components["schemas"]["Account"];
type Posting = components["schemas"]["Posting"];
type Transaction = components["schemas"]["Transaction"];

interface Posted {
  account: Account;
  posting: Posting;
}

const systemRoleKeys: Record<string, MessageKey> = {
  opening_balances: "transactions.title.openingBalance",
  adjustments: "transactions.title.adjustment",
};

// The title of a transaction from its postings: a system-account movement, an exchange of
// currencies, a transfer, else the names of its categories; empty when none applies.
export function postingsTitle(
  tx: Transaction,
  t: TFunction,
  accounts: Map<string, Account>,
): string {
  const posted = tx.postings.flatMap((posting) => {
    const account = accounts.get(posting.account_id);
    return account === undefined ? [] : [{ account, posting }];
  });
  const custody = custodyTitle(tx, t, accounts, posted);
  if (custody !== "") return custody;

  const balance = posted.filter(({ account }) => isBalance(account));

  const systemKey = posted
    .map(({ account }) => systemRoleKeys[account.system_role ?? ""])
    .find((key) => key !== undefined);
  const [opened] = balance;
  if (systemKey !== undefined && opened !== undefined) {
    return t(systemKey, { account: opened.account.name });
  }

  const from = balance.find(({ posting }) => posting.amount.amount < 0);
  const to = balance.find(({ posting }) => posting.amount.amount > 0);
  if (from !== undefined && to !== undefined) {
    const moved = movementTitle(tx, t, accounts, from, to);
    if (moved !== "") return moved;
  }

  return transactionRow(tx, accounts, new Map()).category;
}

// Two postings of one instrument, other than the balancing currency, on holdings whose parents
// are two different brokerages (A228 IO31).
function custodyTitle(
  tx: Transaction,
  t: TFunction,
  accounts: Map<string, Account>,
  posted: Posted[],
): string {
  const [first, second] = posted;
  if (tx.postings.length !== 2 || first === undefined || second === undefined) {
    return "";
  }
  const code = first.account.currency;
  const parents = [first, second].map(({ account }) =>
    accounts.get(account.parent_id ?? ""),
  );
  const [from, to] = parents;
  const brokerages =
    from?.kind === "brokerage" && to?.kind === "brokerage" && from.id !== to.id;

  return brokerages &&
    code === second.account.currency &&
    code !== tx.balancing_currency
    ? t("transactions.title.custody", { code })
    : "";
}

function movementTitle(
  tx: Transaction,
  t: TFunction,
  accounts: Map<string, Account>,
  from: Posted,
  to: Posted,
): string {
  if (from.posting.amount.currency !== to.posting.amount.currency) {
    return t("transactions.title.exchange", {
      from: from.posting.amount.currency,
      to: to.posting.amount.currency,
    });
  }
  if (!rowAmount(tx, accounts).transfer) return "";
  if (to.account.kind === "credit_card") {
    return t("transactions.title.cardPayment", { card: to.account.name });
  }

  return t("transactions.title.transfer", {
    from: from.account.name,
    to: to.account.name,
  });
}

function isBalance(account: Account): boolean {
  return account.class === "asset" || account.class === "liability";
}
