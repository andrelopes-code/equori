import { Inline } from "@slotted/react/inline";
import { Text } from "@slotted/react/typography";

import styles from "@/features/reports/net-worth-tooltip-row.module.css";

interface NetWorthTooltipRowProps {
  label: string;
  value: string;
  strong?: boolean;
}

// One line of the forecast tooltip: a name on the start that wraps in its own column, its amount on
// the end of the first line in one piece.
export function NetWorthTooltipRow({
  label,
  value,
  strong = false,
}: NetWorthTooltipRowProps) {
  return (
    <Inline gap={4} justify="between" align="baseline" wrap="nowrap">
      <Text
        size="sm"
        tone={strong ? "default" : "muted"}
        className={styles.label}
      >
        {label}
      </Text>
      <Text
        size="sm"
        weight={strong ? "semibold" : "medium"}
        className={styles.value}
      >
        {value}
      </Text>
    </Inline>
  );
}
