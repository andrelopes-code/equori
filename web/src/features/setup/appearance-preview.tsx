import { Button } from "@slotted/react/button";
import { Field, FieldLabel } from "@slotted/react/field";
import { ProgressBar } from "@slotted/react/progress-indicator";
import { Tag } from "@slotted/react/tag";
import { TextField } from "@slotted/react/text-field";
import { Text } from "@slotted/react/typography";
import { useQuery } from "@tanstack/react-query";

import { useApi } from "@/api/api-context";
import styles from "@/features/setup/appearance-preview.module.css";
import { settingsQuery } from "@/features/setup/api";
import { useScale } from "@/features/setup/instruments";
import { useT } from "@/i18n/i18n-provider";
import { MoneyFigure } from "@/ui/money-figure";

// Minor units of the sample: a balance, money in, money out and a budget spent to its limit.
const BALANCE = 1284250;
const INCOME = 850000;
const EXPENSE = -18990;
const BUDGET_SPENT = 100;

// The page draws every change of the controls at once; the preview holds what the settings page
// has none of: figures, money in and out, a meter, a field and the two weights of action.
export function AppearancePreview() {
  const t = useT();
  const settings = useQuery(settingsQuery(useApi()));
  const scale = useScale();

  const currency = settings.data?.base_currency;
  const money =
    currency !== undefined && scale !== null
      ? { currency, scale: scale(currency) }
      : null;

  return (
    <div
      className={styles.preview}
      aria-label={t("settings.appearance.preview")}
      role="group"
    >
      <div className={styles.figure}>
        <Text size="xs" tone="muted">
          {t("appearance.preview.balance")}
        </Text>
        {money !== null && (
          <Text size="2xl" weight="semibold" numeric="tabular">
            <MoneyFigure amount={BALANCE} {...money} />
          </Text>
        )}
      </div>

      <div className={styles.rows}>
        <div className={styles.row}>
          <span className={styles.name}>
            <Text size="sm">{t("appearance.preview.income")}</Text>
            <Tag size="sm">{t("appearance.preview.tag")}</Tag>
          </span>
          {money !== null && (
            <Text size="sm" weight="semibold" numeric="tabular" tone="success">
              <MoneyFigure amount={INCOME} {...money} />
            </Text>
          )}
        </div>
        <div className={styles.row}>
          <Text size="sm">{t("appearance.preview.expense")}</Text>
          {money !== null && (
            <Text size="sm" weight="semibold" numeric="tabular">
              <MoneyFigure amount={EXPENSE} {...money} />
            </Text>
          )}
        </div>
      </div>

      <div className={styles.meter}>
        <ProgressBar
          label={t("appearance.preview.budget")}
          value={BUDGET_SPENT}
          max={BUDGET_SPENT}
          tone="danger"
        />
        <Text size="xs" tone="danger">
          {t("appearance.preview.budgetLeft")}
        </Text>
      </div>

      <Field necessity="none">
        <FieldLabel>{t("appearance.preview.field")}</FieldLabel>
        <TextField
          name="preview"
          placeholder={t("appearance.preview.expense")}
        />
      </Field>

      <div className={styles.actions}>
        <Button variant="ghost" tone="secondary">
          {t("appearance.preview.secondary")}
        </Button>
        <Button>{t("appearance.preview.primary")}</Button>
      </div>
    </div>
  );
}
