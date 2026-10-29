import { Field, FieldDescription, FieldLabel } from "@slotted/react/field";

import { AccountField } from "@/features/transactions/account-field";
import type { CaptureSetup } from "@/features/transactions/capture-setup";
import { useT } from "@/i18n/i18n-provider";

interface CaptureDefaultAccountFieldProps {
  setup: CaptureSetup | null;
  value: string | null;
  date: string;
  onChange: (id: string) => void;
}

// The account a line takes when its text names none.
export function CaptureDefaultAccountField({
  setup,
  value,
  date,
  onChange,
}: CaptureDefaultAccountFieldProps) {
  const t = useT();

  if (setup === null) return null;

  return (
    <Field>
      <FieldLabel>{t("capture.defaultAccount")}</FieldLabel>
      <AccountField
        name="default_account_id"
        title={t("capture.defaultAccount")}
        accounts={setup.accounts}
        value={value}
        onChange={onChange}
        exclude={null}
        amount={0}
        direction="out"
        date={date}
        categoryId={null}
        payeeId={null}
        kind="expense"
        currency={setup.base}
        scale={setup.scale}
        compact
        context={t("capture.defaultAccountHint")}
      />
      <FieldDescription>{t("capture.defaultAccountHint")}</FieldDescription>
    </Field>
  );
}
