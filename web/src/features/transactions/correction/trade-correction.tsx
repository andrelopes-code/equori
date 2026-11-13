import { useState } from "react";

import type { components } from "@/api/schema.gen";
import { CorrectionPage } from "@/features/transactions/correction/correction-page";
import { tradeDraftOf } from "@/features/transactions/correction/investment-draft";
import { ReasonField } from "@/features/transactions/correction/reason-field";
import { useCorrectionDone } from "@/features/transactions/correction/use-correction-done";
import { emptyTrade } from "@/features/transactions/trade-entry/trade-draft";
import { TradeForm } from "@/features/transactions/trade-entry/trade-form";
import { useTradeEntry } from "@/features/transactions/trade-entry/use-trade-entry";
import { useAppLocale } from "@/i18n/i18n-provider";

type Account = components["schemas"]["Account"];
type Transaction = components["schemas"]["Transaction"];

interface TradeCorrectionProps {
  transaction: Transaction;
  accounts: readonly Account[];
  scale: (code: string) => number;
}

// A227 IC9: a trade is corrected in the trade form, filled from its order.
export function TradeCorrection({
  transaction,
  accounts,
  scale,
}: TradeCorrectionProps) {
  const [locale] = useAppLocale();
  const done = useCorrectionDone(transaction.id);

  const [start] = useState(
    () =>
      tradeDraftOf(transaction, accounts, locale) ??
      emptyTrade(transaction.date),
  );
  const [reason, setReason] = useState("");

  const entry = useTradeEntry(null, null, { transaction, start, reason });

  async function handleSave() {
    const next = await entry.submit();
    if (next !== null) done();
  }

  return (
    <CorrectionPage
      transaction={transaction}
      pending={entry.pending}
      summary={entry.summary}
      onSave={() => {
        void handleSave();
      }}
    >
      {entry.view.ready && (
        <TradeForm
          draft={entry.draft}
          onChange={entry.setDraft}
          view={entry.view}
          errors={entry.errors}
          scale={scale}
        >
          <ReasonField
            value={reason}
            error={entry.errors.reason}
            onChange={setReason}
          />
        </TradeForm>
      )}
    </CorrectionPage>
  );
}
