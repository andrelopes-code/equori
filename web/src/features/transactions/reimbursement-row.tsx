import { Checkbox } from "@slotted/react/checkbox";
import { Field, FieldLabel } from "@slotted/react/field";

import type { components } from "@/api/schema.gen";
import { formatDate, formatMoney } from "@/i18n/format";
import { useAppLocale, useT } from "@/i18n/i18n-provider";
import { MoneyInput } from "@/ui/money-input";

type Candidate = components["schemas"]["ReimbursementCandidate"];

// One expense the inflow may repay: checking it asks for the amount.
export function ReimbursementRow({
  candidate,
  checked,
  amount,
  scale,
  onCheckedChange,
  onAmountChange,
}: {
  candidate: Candidate;
  checked: boolean;
  amount: number;
  scale: (code: string) => number;
  onCheckedChange: (checked: boolean) => void;
  onAmountChange: (minor: number) => void;
}) {
  const t = useT();
  const [locale] = useAppLocale();
  const { transaction, remaining } = candidate;
  return (
    <div>
      <Checkbox
        checked={checked}
        onCheckedChange={onCheckedChange}
        description={t("reimbursement.option", {
          date: formatDate(transaction.date, locale),
          remaining: formatMoney(remaining, scale(remaining.currency), locale),
        })}
      >
        {transaction.description}
      </Checkbox>
      {checked && (
        <Field>
          <FieldLabel>
            {t("reimbursement.amount", {
              description: transaction.description,
            })}
          </FieldLabel>
          <MoneyInput
            value={amount}
            onChange={onAmountChange}
            currency={remaining.currency}
            scale={scale(remaining.currency)}
            sign="neutral"
          />
        </Field>
      )}
    </div>
  );
}
