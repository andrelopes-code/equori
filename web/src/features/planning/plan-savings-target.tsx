import { Field, FieldLabel } from "@slotted/react/field";
import { TextField } from "@slotted/react/text-field";
import { useState } from "react";
import type { ChangeEvent } from "react";

import styles from "@/features/planning/budget-plan.module.css";
import { PlanLedgerLine } from "@/features/planning/plan-ledger-line";
import {
  bpFromText,
  fromShare,
  planShare,
  textFromBp,
} from "@/features/planning/plan-math";
import type { PlanFormat } from "@/features/planning/use-plan-format";
import { useT } from "@/i18n/i18n-provider";

interface PlanSavingsTargetProps {
  // The reference in minor units; the figures need one above zero.
  reference: number | undefined;
  savings: number;
  // The savings target in basis points of the reference.
  target: number | undefined;
  editable: boolean;
  format: PlanFormat;
  onTarget: (bp: number | undefined) => void;
}

const wholeBp = 10_000;

// The share of the reference set aside (savings target A187): the field, the rate the month's
// savings reach and, below the target, what is still missing. The figures follow the draft
// reference, so they are computed here and not read from the fetched plan.
export function PlanSavingsTarget({
  reference,
  savings,
  target,
  editable,
  format,
  onTarget,
}: PlanSavingsTargetProps) {
  const t = useT();
  const [text, setText] = useState(
    target === undefined ? "" : textFromBp(target),
  );
  const typed = text.trim() === "" ? undefined : bpFromText(text);
  // A discard or a save replaces the draft: the field then shows the target it holds.
  const canonical = target === undefined ? "" : textFromBp(target);
  const shown = typed === target ? text : canonical;
  const base = reference !== undefined && reference > 0 ? reference : undefined;
  const rate = base === undefined ? undefined : planShare(savings, base);
  const amount =
    base === undefined || target === undefined
      ? undefined
      : fromShare(target, base);
  const gap = amount === undefined ? undefined : Math.max(amount - savings, 0);

  function handleChange(event: ChangeEvent<HTMLInputElement>) {
    const next = event.target.value;
    const empty = next.trim() === "";
    const bp = empty ? undefined : bpFromText(next);
    if (!empty && (bp === undefined || bp > wholeBp)) return;
    setText(next);
    onTarget(bp);
  }

  return (
    <div className={styles.ledger}>
      <Field>
        <FieldLabel>{t("plan.savingsTarget")}</FieldLabel>
        <TextField
          name="savings_target"
          inputMode="decimal"
          value={shown}
          readOnly={!editable}
          onChange={handleChange}
        />
      </Field>
      {rate !== undefined && (
        <PlanLedgerLine
          label={t("plan.savingsRate")}
          amount={format.share(rate) ?? t("plan.dash")}
        />
      )}
      {amount !== undefined && (
        <PlanLedgerLine
          label={t("plan.savingsTargetAmount")}
          amount={format.money(amount)}
        />
      )}
      {gap !== undefined && gap > 0 && (
        <PlanLedgerLine
          label={t("plan.savingsGap")}
          amount={format.money(gap)}
        />
      )}
    </div>
  );
}
