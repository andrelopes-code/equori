import type { BuiltKind } from "@/features/transactions/entry-model/entry-kind";
import { useActionEntry } from "@/features/transactions/action-entry/use-action-entry";
import { useCustodyEntry } from "@/features/transactions/custody-entry/use-custody-entry";
import { useExchangeEntry } from "@/features/transactions/exchange-entry/use-exchange-entry";
import { useFixedIncomeEntry } from "@/features/transactions/fixed-income-entry/use-fixed-income-entry";
import { useForeignEntry } from "@/features/transactions/foreign-entry/use-foreign-entry";
import { useIncomeEntry } from "@/features/transactions/income-entry/use-income-entry";
import { useNoteEntry } from "@/features/transactions/note-entry/use-note-entry";
import { useTradeEntry } from "@/features/transactions/trade-entry/use-trade-entry";
import type { NewTransactionSearch } from "@/features/transactions/model/search";
import type { MessageKey } from "@/i18n/catalog.en";

const createdKeys: Record<BuiltKind, MessageKey> = {
  trade: "trade.created",
  fixed_income: "fixedIncome.created",
  investment_income: "income.created",
  brokerage_note: "note.created",
  foreign_purchase: "foreignPurchase.created",
  exchange: "exchange.created",
  corporate_action: "action.created",
  custody_transfer: "custody.created",
};

// One hook per built kind, all called on every render; `entry` is the one the chosen kind uses.
export function useBuiltEntries(
  investment: BuiltKind | null,
  accountId: string | null,
  brokerageId: string | null,
  contract: string | null = null,
  presets: NewTransactionSearch = {},
) {
  const trade = useTradeEntry(accountId, brokerageId, undefined, presets);
  const fixedIncome = useFixedIncomeEntry(brokerageId, contract);
  const income = useIncomeEntry(accountId, undefined, presets);
  const note = useNoteEntry(brokerageId);
  const foreign = useForeignEntry(accountId);
  const exchange = useExchangeEntry(accountId);
  const action = useActionEntry(accountId, brokerageId);
  const custody = useCustodyEntry(accountId, brokerageId);

  const byKind = {
    trade,
    fixed_income: fixedIncome,
    investment_income: income,
    brokerage_note: note,
    foreign_purchase: foreign,
    exchange,
    corporate_action: action,
    custody_transfer: custody,
  };
  const entry = investment === null ? null : byKind[investment];
  const createdKey = investment === null ? null : createdKeys[investment];

  const discardAll = () => {
    trade.discard();
    fixedIncome.discard();
    income.discard();
    note.discard();
    foreign.discard();
    exchange.discard();
    action.discard();
    custody.discard();
  };

  return {
    trade,
    fixedIncome,
    income,
    note,
    foreign,
    exchange,
    action,
    custody,
    entry,
    createdKey,
    discardAll,
  };
}
