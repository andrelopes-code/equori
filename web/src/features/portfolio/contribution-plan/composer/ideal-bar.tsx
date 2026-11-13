import { BoundaryHandle } from "@/features/portfolio/contribution-plan/composer/boundary-handle";
import styles from "@/features/portfolio/contribution-plan/composer/composition-editor.module.css";
import type { CompositionGroup } from "@/features/portfolio/contribution-plan/composer/composition-group";
import { IdealSegment } from "@/features/portfolio/contribution-plan/composer/ideal-segment";
import { useBarWidth } from "@/features/portfolio/contribution-plan/composer/use-bar-width";
import { useT } from "@/i18n/i18n-provider";

interface IdealBarProps {
  groups: CompositionGroup[];
  onTargets: (next: number[]) => void;
}

// Build-own-element. Families read: progress-indicator, whose segments state one task under way;
// chart, which draws a plane with axes; slider, which moves one value on a track. None draws
// adjacent shares with a draggable boundary between each pair. The bar fills its column, so a
// narrow column shortens the labels instead of overflowing.
export function IdealBar({ groups, onTargets }: IdealBarProps) {
  const t = useT();
  const [barWidth, ref] = useBarWidth();

  return (
    <div
      role="group"
      aria-label={t("contributionPlan.barIdeal")}
      data-bar="ideal"
      data-measure="bar"
      ref={ref}
      className={styles.idealBar}
    >
      <div aria-hidden="true" className={styles.segments}>
        {groups.map((group) => (
          <IdealSegment key={group.key} group={group} barWidth={barWidth} />
        ))}
      </div>

      {groups.slice(0, -1).map((group, index) => (
        <BoundaryHandle
          key={group.key}
          index={index}
          groups={groups}
          barWidth={barWidth}
          onTargets={onTargets}
        />
      ))}
    </div>
  );
}
