import { Text } from "@slotted/react/typography";

import styles from "@/features/calculators/calculator-frame/calculators.module.css";

interface MethodListProps {
  lines: readonly string[];
  ordered?: boolean;
}

// A list of lines of the method: numbered for the steps, bulleted for the rest.
export function MethodList({ lines, ordered = false }: MethodListProps) {
  const items = lines.map((line) => (
    <li key={line}>
      <Text size="sm" wrap="pretty">
        {line}
      </Text>
    </li>
  ));

  if (ordered) {
    return <ol className={styles.list}>{items}</ol>;
  }

  return <ul className={styles.list}>{items}</ul>;
}
