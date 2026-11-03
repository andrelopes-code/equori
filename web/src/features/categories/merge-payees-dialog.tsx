import { Radio, RadioGroup } from "@slotted/react/radio-group";
import { useState } from "react";

import { errorText } from "@/api/problem";
import type { components } from "@/api/schema.gen";
import { useMergePayees } from "@/features/categories/api";
import { useT } from "@/i18n/i18n-provider";
import { ConfirmDialog } from "@/ui/confirm-dialog";

type Payee = components["schemas"]["Payee"];

// The selected payees become one: the reader chooses which name stays.
export function MergePayeesDialog({
  payees,
  onDone,
  onCancel,
}: {
  payees: readonly Payee[];
  onDone: () => void;
  onCancel: () => void;
}) {
  const t = useT();
  const merge = useMergePayees();
  const [into, setInto] = useState(payees[0]?.id ?? "");
  const [error, setError] = useState<string | null>(null);

  function handleConfirm() {
    setError(null);
    merge
      .mutateAsync({
        sources: payees.map((p) => p.id).filter((id) => id !== into),
        into,
      })
      .then(onDone)
      .catch((caught: unknown) => {
        setError(errorText(caught, t));
      });
  }

  return (
    <ConfirmDialog
      title={t("payees.mergeTitle", { count: payees.length })}
      description={t("payees.mergeDescription")}
      confirmLabel={t("payees.merge")}
      pending={merge.isPending}
      error={error}
      onConfirm={handleConfirm}
      onCancel={onCancel}
    >
      <RadioGroup
        aria-label={t("payees.keep")}
        value={into}
        onValueChange={(value) => {
          if (typeof value === "string") setInto(value);
        }}
      >
        {payees.map((payee) => (
          <Radio key={payee.id} value={payee.id}>
            {payee.name}
          </Radio>
        ))}
      </RadioGroup>
    </ConfirmDialog>
  );
}
