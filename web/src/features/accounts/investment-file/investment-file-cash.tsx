import { Field, FieldLabel } from "@slotted/react/field";

import type { components } from "@/api/schema.gen";
import { AccountField, useBrokerages } from "@/features/transactions";
import { useT } from "@/i18n/i18n-provider";

type Account = components["schemas"]["Account"];

interface InvestmentFileCashProps {
  brokerage: Account;
  value: string | null;
  scale: (code: string) => number;
  onChange: (id: string) => void;
}

// The account that pays and receives, asked only when the brokerage has several (IF4).
export function InvestmentFileCash({
  brokerage,
  value,
  scale,
  onChange,
}: InvestmentFileCashProps) {
  const t = useT();
  const { payers } = useBrokerages(brokerage.id, null);

  if (payers.length < 2) return null;

  return (
    <Field>
      <FieldLabel>{t("investmentFile.cash")}</FieldLabel>
      <AccountField
        compact
        name="cash"
        title={t("investmentFile.cash")}
        context={t("investmentFile.cash")}
        accounts={payers}
        value={value}
        exclude={null}
        amount={0}
        direction="out"
        date={new Date().toISOString().slice(0, 10)}
        categoryId={null}
        payeeId={null}
        kind="transfer"
        currency={brokerage.currency}
        scale={scale}
        onChange={onChange}
      />
    </Field>
  );
}
