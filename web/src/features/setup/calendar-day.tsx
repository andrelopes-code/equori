import styles from "@/features/setup/settings-page.module.css";

// Families read: calendar, badge, avatar. None draws one day as a tile with its weekday, so the
// tile is the page's own.
export function CalendarDay({
  weekday,
  day,
}: {
  weekday: string;
  day: string;
}) {
  return (
    <span className={styles.day} aria-hidden="true">
      <span className={styles.dayName}>{weekday}</span>
      <span className={styles.dayNumber}>{day}</span>
    </span>
  );
}
