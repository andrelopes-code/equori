import { Heading, Text } from "@slotted/react/typography";

import { useScale } from "@/features/setup";
import { useT } from "@/i18n/i18n-provider";
import { useMoneyFormat } from "@/privacy/use-money-format";

import styles from "@/features/portfolio/return-money/return-growth-bar.module.css";

interface ReturnGrowthBarProps {
  deposits: number;
  gain: number;
  currency: string;
}

const parts = [
  { key: "deposits", label: "return.money.deposits" },
  { key: "gain", label: "return.money.gain" },
] as const;

// Workaround for Slotted issue #82: no family draws a whole split in two parts as lengths.
// Families read: progress-indicator, whose role and end mark state a task under way, and chart,
// which draws series against an axis. The bar is aria-hidden because the legend states both
// amounts as text.
export function ReturnGrowthBar({
  deposits,
  gain,
  currency,
}: ReturnGrowthBarProps) {
  const t = useT();
  const fmt = useMoneyFormat();
  const scale = useScale();

  const amounts = { deposits, gain };
  const money = (amount: number) =>
    fmt.money({ amount, currency }, scale?.(currency) ?? 0);

  return (
    <div className={styles.growth}>
      <Heading size="sm">{t("return.growth.title")}</Heading>

      <div className={styles.bar} aria-hidden="true">
        {parts.map(({ key }) => (
          <div
            key={key}
            data-segment={key}
            className={[styles.segment, styles[key]].join(" ")}
            style={{ flexGrow: amounts[key] }}
          />
        ))}
      </div>

      <div className={styles.legend}>
        {parts.map(({ key, label }) => (
          <div key={key} data-legend={key} className={styles.item}>
            <div
              className={[styles.swatch, styles[key]].join(" ")}
              aria-hidden="true"
            />
            <Text size="sm">{t(label)}</Text>
            <Text size="sm" weight="semibold" numeric="tabular">
              {money(amounts[key])}
            </Text>
          </div>
        ))}
      </div>
    </div>
  );
}
