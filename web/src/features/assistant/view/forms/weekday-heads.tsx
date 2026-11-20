import styles from "@/features/assistant/view/forms/forms.module.css";
import { useAppLocale } from "@/i18n/i18n-provider";

interface WeekdayHeadsProps {
  // ISO number of the first weekday (1 = Monday … 7 = Sunday).
  firstDay: number;
}

// The narrow names of the seven weekdays, from the locale's first one.
export function WeekdayHeads({ firstDay }: WeekdayHeadsProps) {
  const [locale] = useAppLocale();

  const names = Array.from({ length: 7 }, (_, i) => {
    // 2024-01-01 is a Monday: day n of the ISO week is 2024-01-0n.
    const iso = ((firstDay - 1 + i) % 7) + 1;
    return new Intl.DateTimeFormat(locale, {
      weekday: "narrow",
      timeZone: "UTC",
    }).format(new Date(Date.UTC(2024, 0, iso)));
  });

  return (
    <>
      {names.map((name, i) => (
        <span key={i} className={styles.heatHead}>
          {name}
        </span>
      ))}
    </>
  );
}
