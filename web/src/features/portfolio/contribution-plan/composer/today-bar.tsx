import styles from "@/features/portfolio/contribution-plan/composer/composition-editor.module.css";
import type { CompositionGroup } from "@/features/portfolio/contribution-plan/composer/composition-group";
import { slotClass } from "@/features/portfolio/contribution-plan/composer/slot-class";
import { shareText } from "@/features/portfolio/contribution-plan/model/share-text";
import { useAppLocale, useT } from "@/i18n/i18n-provider";

interface TodayBarProps {
  groups: CompositionGroup[];
}

// The groups at their share today, on the scale of the ideal bar above.
export function TodayBar({ groups }: TodayBarProps) {
  const t = useT();
  const [tag] = useAppLocale();

  const shares = groups
    .map((g) => `${g.name} ${shareText((g.todayBp ?? 0) / 10000, tag)}`)
    .join(", ");

  return (
    <div
      role="img"
      aria-label={`${t("contributionPlan.barToday")}: ${shares}`}
      data-bar="today"
      className={[styles.thinBar, styles.segments].join(" ")}
    >
      {groups.map((group) => (
        <div
          key={group.key}
          data-segment=""
          className={[styles.segment, slotClass(group.colour)].join(" ")}
          style={{ flexGrow: group.todayBp ?? 0 }}
        />
      ))}
    </div>
  );
}
