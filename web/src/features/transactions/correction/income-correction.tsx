import { useState } from "react";

import type { components } from "@/api/schema.gen";
import { CorrectionPage } from "@/features/transactions/correction/correction-page";
import { incomeDraftOf } from "@/features/transactions/correction/investment-draft";
import { ReasonField } from "@/features/transactions/correction/reason-field";
import { useCorrectionDone } from "@/features/transactions/correction/use-correction-done";
import { emptyIncome } from "@/features/transactions/income-entry/income-draft";
import { IncomeForm } from "@/features/transactions/income-entry/income-form";
import { useIncomeEntry } from "@/features/transactions/income-entry/use-income-entry";

type Account = components["schemas"]["Account"];
type Transaction = components["schemas"]["Transaction"];

interface IncomeCorrectionProps {
  transaction: Transaction;
  accounts: readonly Account[];
  scale: (code: string) => number;
}

// A227 IC9: an investment income is corrected in the income form, filled from its order.
export function IncomeCorrection({
  transaction,
  accounts,
  scale,
}: IncomeCorrectionProps) {
  const done = useCorrectionDone(transaction.id);

  const [start] = useState(
    () => incomeDraftOf(transaction, accounts) ?? emptyIncome(transaction.date),
  );
  const [reason, setReason] = useState("");

  const entry = useIncomeEntry(null, { transaction, start, reason });

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
        <IncomeForm
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
        </IncomeForm>
      )}
    </CorrectionPage>
  );
}
