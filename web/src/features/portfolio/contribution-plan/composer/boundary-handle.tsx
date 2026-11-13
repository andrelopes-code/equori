import styles from "@/features/portfolio/contribution-plan/composer/composition-editor.module.css";
import type { CompositionGroup } from "@/features/portfolio/contribution-plan/composer/composition-group";
import { useBoundaryMove } from "@/features/portfolio/contribution-plan/composer/use-boundary-move";
import { shareText } from "@/features/portfolio/contribution-plan/model/share-text";
import { useAppLocale, useT } from "@/i18n/i18n-provider";

interface BoundaryHandleProps {
  // The handle sits between groups[index] and groups[index + 1].
  index: number;
  groups: CompositionGroup[];
  barWidth: number;
  onTargets: (next: number[]) => void;
}

// The slider that moves one boundary of the ideal bar. A locked neighbour disables it.
export function BoundaryHandle({
  index,
  groups,
  barWidth,
  onTargets,
}: BoundaryHandleProps) {
  const t = useT();
  const [tag] = useAppLocale();

  const left = groups[index];
  const right = groups[index + 1];
  const targets = groups.map((g) => g.targetBp);
  const disabled = left?.locked === true || right?.locked === true;
  const move = useBoundaryMove({
    index,
    targets,
    locked: groups.map((g) => g.locked),
    disabled,
    barWidth,
    onTargets,
  });

  if (left === undefined || right === undefined) return null;

  const position = targets.slice(0, index + 1).reduce((sum, bp) => sum + bp, 0);
  const share = (bp: number) => shareText(bp / 10000, tag);

  return (
    <div
      role="slider"
      tabIndex={disabled ? -1 : 0}
      aria-label={t("contributionPlan.handle", {
        left: left.name,
        right: right.name,
      })}
      aria-valuemin={0}
      aria-valuemax={left.targetBp + right.targetBp}
      aria-valuenow={left.targetBp}
      aria-valuetext={t("contributionPlan.handleValue", {
        left: left.name,
        leftShare: share(left.targetBp),
        right: right.name,
        rightShare: share(right.targetBp),
      })}
      {...(disabled ? { "aria-disabled": true } : {})}
      className={styles.handle}
      style={{ insetInlineStart: `${String(position / 100)}%` }}
      {...move}
    >
      <span className={styles.grip} />
    </div>
  );
}
