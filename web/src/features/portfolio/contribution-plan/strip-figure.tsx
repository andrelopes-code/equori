import { Text } from "@slotted/react/typography";

import type { components } from "@/api/schema.gen";
import styles from "@/features/portfolio/contribution-plan/contribution-strip.module.css";
import { useScale } from "@/features/setup";
import { useMoneyFormat } from "@/privacy/use-money-format";

type Money = components["schemas"]["Money"];

interface StripFigureProps {
  label: string;
  value: Money;
}

export function StripFigure({ label, value }: StripFigureProps) {
  const fmt = useMoneyFormat();
  const scale = useScale();

  return (
    <div className={styles.figure}>
      <Text size="xs" tone="muted">
        {label}
      </Text>

      <Text size="lg" weight="semibold" numeric="tabular">
        {fmt.money(value, scale?.(value.currency) ?? 0)}
      </Text>
    </div>
  );
}
