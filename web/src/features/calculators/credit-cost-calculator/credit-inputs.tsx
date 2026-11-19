import { Field, FieldLabel } from "@slotted/react/field";

import styles from "@/features/calculators/calculator-frame/calculators.module.css";
import { addressKeys } from "@/features/calculators/credit-cost-calculator/address-keys";
import { AmountField } from "@/features/calculators/fields/amount-field";
import { CountField } from "@/features/calculators/fields/count-field";
import type { CalculatorMoney } from "@/features/calculators/fields/use-calculator-money";
import { monthlyDates } from "@/features/calculators/model/credit-math";
import { useCalculatorSearch } from "@/features/calculators/model/calculator-search";
import { useT } from "@/i18n/i18n-provider";
import { DateInput } from "@/ui/form-fields/date-input";

interface CreditInputsProps {
  money: CalculatorMoney;
  releaseDate: string;
  firstDue: string | null;
}

export function CreditInputs({
  money,
  releaseDate,
  firstDue,
}: CreditInputsProps) {
  const t = useT();
  const [search, set] = useCalculatorSearch(addressKeys);

  return (
    <>
      <AmountField
        label={t("calc.credit.released")}
        hint={t("calc.credit.released.hint")}
        width="medium"
        value={search.released}
        money={money}
        onChange={(v) => {
          set({ released: v });
        }}
      />

      <div className={styles.pair}>
        <CountField
          label={t("calc.credit.count")}
          unit={t("calc.unit.installments")}
          name="count"
          width="short"
          value={search.count ?? ""}
          onChange={(v) => {
            set({ count: v });
          }}
        />

        <AmountField
          label={t("calc.credit.installment")}
          help={t("calc.credit.annual.help")}
          width="medium"
          value={search.installment}
          money={money}
          onChange={(v) => {
            set({ installment: v });
          }}
        />
      </div>

      <div className={styles.pair}>
        <Field necessity="none" width="medium">
          <FieldLabel>{t("calc.credit.releaseDate")}</FieldLabel>
          <DateInput
            name="releaseDate"
            value={releaseDate}
            shortcuts={false}
            onChange={(v) => {
              set({ releaseDate: v });
            }}
          />
        </Field>

        <Field necessity="none" width="medium">
          <FieldLabel>{t("calc.credit.firstDue")}</FieldLabel>
          <DateInput
            name="firstDue"
            value={firstDue ?? monthlyDates(releaseDate, 2)[1] ?? releaseDate}
            shortcuts={false}
            onChange={(v) => {
              set({ firstDue: v });
            }}
          />
        </Field>
      </div>
    </>
  );
}
