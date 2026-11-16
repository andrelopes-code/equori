import type { components } from "@/api/schema.gen";
import type {
  BuiltKind,
  EntryKind,
} from "@/features/transactions/entry-model/entry-kind";
import { ActionForm } from "@/features/transactions/action-entry/action-form";
import { CustodyForm } from "@/features/transactions/custody-entry/custody-form";
import { ExchangeForm } from "@/features/transactions/exchange-entry/exchange-form";
import { FixedIncomeForm } from "@/features/transactions/fixed-income-entry/fixed-income-form";
import { ForeignForm } from "@/features/transactions/foreign-entry/foreign-form";
import { IncomeForm } from "@/features/transactions/income-entry/income-form";
import { NoteForm } from "@/features/transactions/note-entry/note-form";
import type { useBuiltEntries } from "@/features/transactions/new-entry/use-built-entries";
import { TradeForm } from "@/features/transactions/trade-entry/trade-form";

type Entries = ReturnType<typeof useBuiltEntries>;

interface BuiltEntryFormProps {
  investment: BuiltKind | null;
  ready: boolean;
  scale: ((code: string) => number) | null;
  payees: readonly components["schemas"]["Payee"][];
  entries: Pick<
    Entries,
    | "trade"
    | "fixedIncome"
    | "income"
    | "note"
    | "foreign"
    | "exchange"
    | "action"
    | "custody"
  >;
  onKind: (kind: EntryKind) => void;
}

export function BuiltEntryForm({
  investment,
  ready,
  scale,
  payees,
  entries,
  onKind,
}: BuiltEntryFormProps) {
  const {
    trade,
    fixedIncome,
    income,
    note,
    foreign,
    exchange,
    action,
    custody,
  } = entries;

  return (
    <>
      {ready && investment === "investment_income" && scale !== null && (
        <IncomeForm
          draft={income.draft}
          onChange={income.setDraft}
          view={income.view}
          errors={income.errors}
          scale={scale}
          onKind={onKind}
        />
      )}

      {ready && investment === "brokerage_note" && scale !== null && (
        <NoteForm
          draft={note.draft}
          onChange={note.setDraft}
          view={note.view}
          errors={note.errors}
          scale={scale}
          onKind={onKind}
        />
      )}

      {ready && investment === "exchange" && scale !== null && (
        <ExchangeForm
          draft={exchange.draft}
          onChange={exchange.setDraft}
          view={exchange.view}
          errors={exchange.errors}
          scale={scale}
          onKind={onKind}
        />
      )}

      {ready && investment === "corporate_action" && scale !== null && (
        <ActionForm
          draft={action.draft}
          onChange={action.setDraft}
          view={action.view}
          errors={action.errors}
          scale={scale}
          onKind={onKind}
        />
      )}

      {ready && investment === "custody_transfer" && scale !== null && (
        <CustodyForm
          draft={custody.draft}
          onChange={custody.setDraft}
          view={custody.view}
          errors={custody.errors}
          scale={scale}
          onKind={onKind}
        />
      )}

      {ready && investment === "foreign_purchase" && scale !== null && (
        <ForeignForm
          draft={foreign.draft}
          onChange={foreign.setDraft}
          view={foreign.view}
          errors={foreign.errors}
          scale={scale}
          payees={payees}
          onKind={onKind}
        />
      )}

      {ready && investment === "fixed_income" && scale !== null && (
        <FixedIncomeForm
          draft={fixedIncome.draft}
          onChange={fixedIncome.setDraft}
          view={fixedIncome.view}
          errors={fixedIncome.errors}
          scale={scale}
          onKind={onKind}
        />
      )}

      {ready && investment === "trade" && scale !== null && (
        <TradeForm
          draft={trade.draft}
          onChange={trade.setDraft}
          view={trade.view}
          errors={trade.errors}
          scale={scale}
          onKind={onKind}
        />
      )}
    </>
  );
}
