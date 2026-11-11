import { Checkbox } from "@slotted/react/checkbox";
import { Field, FieldLabel } from "@slotted/react/field";

import type { components } from "@/api/schema.gen";
import { formatDate } from "@/i18n/format";
import { useAppLocale, useT } from "@/i18n/i18n-provider";
import { MoneyInput } from "@/ui/money-input";
import { useMoneyFormat } from "@/privacy/use-money-format";

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
  const fmt = useMoneyFormat();
  const { transaction, remaining } = candidate;
  return (
    <div>
      <Checkbox
        checked={checked}
        onCheckedChange={onCheckedChange}
        description={t("reimbursement.option", {
          date: formatDate(transaction.date, locale),
          remaining: fmt.money(remaining, scale(remaining.currency)),
        })}
      >
        {transaction.description}
      </Checkbox>
      {checked && (
        <Field required>
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
