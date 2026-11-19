import { Alert, AlertContent, AlertDescription } from "@slotted/react/alert";
import { Field, FieldLabel } from "@slotted/react/field";

import styles from "@/features/calculators/calculator-frame/calculators.module.css";
import { addressKeys } from "@/features/calculators/correction-calculator/address-keys";
import { AmountField } from "@/features/calculators/fields/amount-field";
import { ChoiceField } from "@/features/calculators/fields/choice-field";
import type { CalculatorMoney } from "@/features/calculators/fields/use-calculator-money";
import { useCalculatorSearch } from "@/features/calculators/model/calculator-search";
import { indexName } from "@/features/calculators/rate-source/index-catalog";
import { useT } from "@/i18n/i18n-provider";
import { MonthControl } from "@/ui/navigation/month-control";

interface CorrectionInputsProps {
  money: CalculatorMoney;
  indexes: { id: string }[];
  // The chosen index id; undefined while the instance stores none.
  index: string | undefined;
  from: string | null;
  to: string | null;
}

export function CorrectionInputs({
  money,
  indexes,
  index,
  from,
  to,
}: CorrectionInputsProps) {
  const t = useT();
  const [search, set] = useCalculatorSearch(addressKeys);

  return (
    <>
      <AmountField
        label={t("calc.correction.amount")}
        hint={t("calc.correction.amount.hint")}
        width="medium"
        value={search.amount}
        money={money}
        onChange={(v) => {
          set({ amount: v });
        }}
      />

      {index === undefined && (
        <Alert tone="info">
          <AlertContent>
            <AlertDescription>{t("calc.noIndexes")}</AlertDescription>
          </AlertContent>
        </Alert>
      )}

      {index !== undefined && (
        <>
          <ChoiceField
            label={t("calc.index")}
            help={t("calc.correction.index.help")}
            choices={indexes.map((i) => ({
              value: i.id,
              label: indexName(i.id),
            }))}
            value={index}
            onChange={(next) => {
              set({ index: next });
            }}
          />

          <div className={styles.pair}>
            {from !== null && (
              <Field necessity="none">
                <FieldLabel>{t("calc.correction.from")}</FieldLabel>
                <MonthControl
                  label={t("calc.correction.from")}
                  value={from}
                  onChange={(m) => {
                    set({ from: m });
                  }}
                />
              </Field>
            )}

            {to !== null && (
              <Field necessity="none">
                <FieldLabel>{t("calc.correction.to")}</FieldLabel>
                <MonthControl
                  label={t("calc.correction.to")}
                  value={to}
                  onChange={(m) => {
                    set({ to: m });
                  }}
                />
              </Field>
            )}
          </div>
        </>
      )}
    </>
  );
}
