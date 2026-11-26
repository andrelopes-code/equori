import { Text } from "@slotted/react/typography";
import type { CSSProperties } from "react";

import type { WalletCycle } from "@/features/overview/cards/wallet";
import styles from "@/features/overview/cards/wallet.module.css";
import { formatDayMonthNumeric, formatRelativeDays } from "@/i18n/format";
import { useAppLocale, useT } from "@/i18n/i18n-provider";

interface CycleRailProps {
  // Undefined when the card has no open statement.
  cycle: WalletCycle | undefined;
  name: string;
}

// The open cycle of a card: the days gone up to today, the closing marked and the days up to
// the due date hatched (CD7).
export function CycleRail({ cycle, name }: CycleRailProps) {
  const t = useT();
  const [locale] = useAppLocale();

  if (cycle === undefined) {
    return (
      <div className={styles.rail} data-none="">
        <Text size="sm" tone="muted">
          {t("overview.cards.noBill")}
        </Text>
      </div>
    );
  }

  const closes = t("overview.cards.closesIn", {
    when: formatRelativeDays(cycle.left, locale),
  });
  const due = formatDayMonthNumeric(cycle.due, locale);
  const shut = formatDayMonthNumeric(cycle.closes, locale);
  const start = formatDayMonthNumeric(cycle.start, locale);
  const style = {
    "--today": String(cycle.today),
    "--close": String(cycle.close),
  } as CSSProperties;

  return (
    <div
      className={styles.rail}
      role="img"
      aria-label={t("overview.cards.railLabel", {
        name,
        start,
        closes,
        date: shut,
        due,
      })}
      style={style}
    >
      <div className={styles.railHead}>
        <Text className={styles.railLead} size="sm" weight="medium">
          {closes}
        </Text>
        <Text size="sm" tone="muted">
          {t("overview.cards.dueOn", { date: due })}
        </Text>
      </div>

      <div className={styles.railTrack} aria-hidden="true">
        <span className={styles.railDone} />
        <span className={styles.railWindow} />
        <span className={styles.railClose} />
        <span className={styles.railToday} />
      </div>

      <div className={styles.railFoot} aria-hidden="true">
        <Text size="xs" tone="muted">
          {start}
        </Text>
        <Text className={styles.railShut} size="xs" tone="muted">
          {shut}
        </Text>
      </div>
    </div>
  );
}
