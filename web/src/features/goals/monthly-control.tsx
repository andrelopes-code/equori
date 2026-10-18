import { Slider } from "@slotted/react/slider";

import { monthlyRange } from "@/features/goals/goal-plan";
import styles from "@/features/goals/goals-page.module.css";
import { useAppLocale, useT } from "@/i18n/i18n-provider";
import { MoneyText } from "@/ui/money-text";

// Complete frontend R5-1: the what-if slider in major units, its amount beside it.
export function MonthlyControl({
  goal,
  major,
  unit,
  currency,
  scale,
  onChange,
}: {
  goal: string;
  major: number;
  unit: number;
  currency: string;
  scale: number;
  onChange: (major: number) => void;
}) {
  const t = useT();
  const [locale] = useAppLocale();
  return (
    <span className={styles.monthly}>
      <Slider
        aria-label={t("goals.monthly.for", { goal })}
        value={major}
        min={monthlyRange.min}
        max={monthlyRange.max}
        step={monthlyRange.step}
        size="sm"
        valueLabel="none"
        locale={locale}
        format={{ style: "currency", currency, maximumFractionDigits: 0 }}
        onValueChange={(value) => {
          if (typeof value === "number") onChange(value);
        }}
      />
      <span className={styles.amount}>
        <MoneyText
          money={{ amount: major * unit, currency }}
          scale={scale}
          symbol={false}
        />
      </span>
    </span>
  );
}
