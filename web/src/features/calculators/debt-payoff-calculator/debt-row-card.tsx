import { Button } from "@slotted/react/button";
import { Card, CardActions, CardBody, CardHeader } from "@slotted/react/card";
import { Field, FieldLabel } from "@slotted/react/field";
import { TextField } from "@slotted/react/text-field";
import { Text } from "@slotted/react/typography";

import styles from "@/features/calculators/calculator-frame/calculators.module.css";
import type { DebtRow } from "@/features/calculators/debt-payoff-calculator/debt-rows";
import { AmountField } from "@/features/calculators/fields/amount-field";
import { FilledNote } from "@/features/calculators/fields/filled-note";
import { RateField } from "@/features/calculators/fields/rate-field";
import type { CalculatorMoney } from "@/features/calculators/fields/use-calculator-money";
import { formatDate } from "@/i18n/format";
import { useAppLocale, useT } from "@/i18n/i18n-provider";
import { useToday } from "@/i18n/today";

interface DebtRowCardProps {
  money: CalculatorMoney;
  // The position of the row, from 1.
  n: number;
  row: DebtRow;
  // The name of the account whose balance filled the row.
  origin: string | undefined;
  onChange: (patch: Partial<DebtRow>) => void;
  onRemove: () => void;
}

export function DebtRowCard({
  money,
  n,
  row,
  origin,
  onChange,
  onRemove,
}: DebtRowCardProps) {
  const t = useT();
  const [locale] = useAppLocale();
  const today = useToday();

  return (
    <Card fill="subtle" size="sm">
      <CardHeader>
        <Text size="sm" weight="semibold">
          {t("calc.debt.row", { n })}
        </Text>
        <CardActions>
          <Button size="sm" variant="ghost" tone="secondary" onClick={onRemove}>
            {t("calc.debt.remove", { n })}
          </Button>
        </CardActions>
      </CardHeader>

      <CardBody>
        <div className={styles.pair}>
          <Field necessity="none">
            <FieldLabel>{t("calc.debt.name", { n })}</FieldLabel>
            <TextField
              name={`debt-${String(n)}-name`}
              value={row.name}
              onChange={(event) => {
                onChange({ name: event.target.value });
              }}
            />
          </Field>

          <AmountField
            label={t("calc.debt.balance", { n })}
            value={row.balance === "" ? undefined : row.balance}
            money={money}
            onChange={(v) => {
              onChange({ balance: v ?? "", account: undefined });
            }}
          >
            {origin !== undefined && (
              <FilledNote
                origin={t("calc.debt.origin", {
                  account: origin,
                  date: formatDate(today, locale),
                })}
              />
            )}
          </AmountField>

          <RateField
            label={t("calc.debt.rate", { n })}
            name={`debt-${String(n)}-rate`}
            value={row.rate}
            onChange={(v) => {
              onChange({ rate: v });
            }}
          />

          <AmountField
            label={t("calc.debt.minimum", { n })}
            help={t("calc.debt.minimum.help")}
            value={row.minimum === "" ? undefined : row.minimum}
            money={money}
            onChange={(v) => {
              onChange({ minimum: v ?? "" });
            }}
          />
        </div>
      </CardBody>
    </Card>
  );
}
