import { Field, FieldDescription } from "@slotted/react/field";

import type { Kind } from "@/features/accounts/account-kinds";
import { classOf } from "@/features/accounts/account-kinds";
import { openingLabel } from "@/features/accounts/opening-label";
import { useT } from "@/i18n/i18n-provider";
import { FieldTitle } from "@/ui/field-title";
import widths from "@/ui/field-width.module.css";
import { FormSection } from "@/ui/form-section";
import { MoneyInput } from "@/ui/money-input";

interface AccountOpeningSectionProps {
  kind: Kind;
  value: number;
  onChange: (opening: number) => void;
  currency: string;
  scale: number;
}

// The balance the ledger starts from on the opening day.
export function AccountOpeningSection({
  kind,
  value,
  onChange,
  currency,
  scale,
}: AccountOpeningSectionProps) {
  const t = useT();

  return (
    <FormSection legend={t("accountForm.openingGroup")}>
      <Field>
        <FieldTitle
          label={t(openingLabel(kind, classOf(kind)))}
          help={t("accountForm.openingHelp")}
        />
        <MoneyInput
          size="field"
          className={widths.medium}
          value={value}
          onChange={onChange}
          currency={currency}
          scale={scale}
          sign="neutral"
        />
        <FieldDescription>{t("accountForm.openingHint")}</FieldDescription>
      </Field>
    </FormSection>
  );
}
