import { Icon } from "@slotted/react/icon";
import { Text } from "@slotted/react/typography";

import { SettingsIcon } from "@/features/setup/settings-icon";
import styles from "@/features/setup/settings-page.module.css";
import { useT } from "@/i18n/i18n-provider";

// A week from a Wednesday: its Saturday is the date due, and the Monday after the weekend is the
// date the following rule uses under every calendar whose weekend holds Saturday and Sunday.
const days = [
  "2026-11-04",
  "2026-11-05",
  "2026-11-06",
  "2026-11-07",
  "2026-11-08",
  "2026-11-09",
  "2026-11-10",
] as const;
const due = 3;
const used = 5;
const off = new Set([3, 4]);

// Families read: calendar, timeline. The calendar draws a month to pick a day from; none draws a
// strip of days with one date moving to another, so the strip is the page's own. It is one image
// with a sentence for its name: the cells repeat what the sentence says.
export function CalendarShiftExample({
  weekday,
  day,
  date,
}: {
  weekday: (iso: string) => string;
  day: (iso: string) => string;
  date: (iso: string) => string;
}) {
  const t = useT();
  return (
    <div
      className={styles.strip}
      role="img"
      aria-label={t("calendar.how.example", {
        asked: date(days[due]),
        used: date(days[used]),
      })}
    >
      {days.map((iso, index) => (
        <span
          key={iso}
          className={styles.cell}
          data-off={off.has(index) || undefined}
          data-state={
            index === due ? "due" : index === used ? "used" : undefined
          }
        >
          <span className={styles.cellName}>{weekday(iso)}</span>
          <span className={styles.cellNumber}>{day(iso)}</span>
        </span>
      ))}
      <span className={styles.stripLabel} data-column="due">
        <Text size="xs" weight="medium" tone="muted">
          {t("calendar.how.asked")}
        </Text>
      </span>
      <span className={styles.stripArrow}>
        <Icon size="sm" tone="accent" directional>
          <SettingsIcon name="next" />
        </Icon>
      </span>
      <span className={styles.stripLabel} data-column="used">
        <Text size="xs" weight="medium" tone="accent">
          {t("calendar.how.used")}
        </Text>
      </span>
      <span className={styles.stripLegend}>
        <span className={styles.legendSwatch} data-off />
        <Text size="xs" tone="muted">
          {t("calendar.how.off")}
        </Text>
      </span>
    </div>
  );
}
