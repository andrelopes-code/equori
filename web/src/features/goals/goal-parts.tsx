import {
  Collapsible,
  CollapsibleHeader,
  CollapsiblePanel,
  CollapsibleTrigger,
} from "@slotted/react/collapsible";
import { Text } from "@slotted/react/typography";

import type { Goal } from "@/features/goals/goal-line";
import styles from "@/features/goals/goals.module.css";
import { numberFormatter } from "@/i18n/format";
import { useAppLocale, useT } from "@/i18n/i18n-provider";
import { useMoneyFormat } from "@/privacy/use-money-format";

// What the goal's current amount is made of: each instrument held in each goal account, with
// its quantity, its value in the goal currency and its share. A goal over one cash account
// has nothing to break down.
export function GoalParts({
  goal,
  scale,
  names,
}: {
  goal: Goal;
  scale: (code: string) => number;
  names: ReadonlyMap<string, string>;
}) {
  const t = useT();
  const [locale] = useAppLocale();
  const fmt = useMoneyFormat();
  const parts = goal.parts ?? [];
  const only = parts[0];
  if (
    parts.length === 0 ||
    (parts.length === 1 && only?.instrument === goal.target.currency)
  )
    return null;
  const share = numberFormatter(locale, { style: "percent" });
  return (
    <Collapsible size="sm" className={styles.partsBlock}>
      <CollapsibleHeader>
        <CollapsibleTrigger>{t("goals.parts")}</CollapsibleTrigger>
      </CollapsibleHeader>
      <CollapsiblePanel>
        <ul className={styles.parts}>
          {parts.map((part) => (
            <li key={`${part.account_id}-${part.instrument}`}>
              <div className={styles.partName}>
                <Text size="sm" weight="medium">
                  {names.get(part.account_id) ?? part.account_id}
                </Text>
                <Text size="xs" tone="muted">
                  {part.instrument}
                </Text>
              </div>
              <div className={styles.partValue}>
                <Text size="sm" numeric="tabular" align="end">
                  {fmt.money(part.value, scale(part.value.currency))}
                </Text>
                {part.instrument !== goal.target.currency && (
                  <Text size="xs" tone="muted" numeric="tabular" align="end">
                    {fmt.money(part.quantity, scale(part.instrument))}
                  </Text>
                )}
              </div>
              <Text size="sm" tone="muted" numeric="tabular" align="end">
                {share.format(
                  goal.current.amount > 0
                    ? Math.floor(
                        (part.value.amount * 100) / goal.current.amount,
                      ) / 100
                    : 0,
                )}
              </Text>
            </li>
          ))}
        </ul>
      </CollapsiblePanel>
    </Collapsible>
  );
}
