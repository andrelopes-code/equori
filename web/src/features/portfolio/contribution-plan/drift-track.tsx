import {
  formatShare,
  noValue,
} from "@/features/portfolio/contribution-plan/figures";
import styles from "@/features/portfolio/contribution-plan/drift-track.module.css";
import { useAppLocale, useT } from "@/i18n/i18n-provider";

interface DriftTrackProps {
  name: string;
  // Basis points of the whole the track stands in; the bar is drawn on the scale of its table.
  current: number | undefined;
  after: number | undefined;
  target: number | undefined;
  scale: number;
  // The position of the class in the plan; it picks the colour of the data palette.
  position: number;
}

const paletteSize = 8;

// Families read: progress-indicator, whose role and end mark state a task under way, sparkline,
// which draws a series with no target, and chart, which draws a plane. None draws a share beside
// its target. Bar and target are the element's own, painted from the data tokens in plan order.
// The lighter segment spans the change between the current and the after share: a class whose
// share falls shows what it gives up in the same step.
export function DriftTrack({
  name,
  current,
  after,
  target,
  scale,
  position,
}: DriftTrackProps) {
  const t = useT();
  const [tag] = useAppLocale();

  const from = current ?? 0;
  const to = after ?? from;
  const label = t("contributionPlan.track", {
    name,
    current: formatShare(tag, current),
    after: formatShare(tag, after),
    target: target === undefined ? noValue : formatShare(tag, target),
  });
  const slot = styles[`slot${String((position % paletteSize) + 1)}`];

  return (
    <div
      role="img"
      aria-label={label}
      className={[styles.track, slot].join(" ")}
    >
      <div
        className={styles.solid}
        style={{ inlineSize: along(Math.min(from, to), scale) }}
      />

      <div
        className={styles.change}
        style={{
          insetInlineStart: along(Math.min(from, to), scale),
          inlineSize: along(Math.abs(to - from), scale),
        }}
      />

      {target !== undefined && (
        <div
          className={styles.target}
          style={{ insetInlineStart: along(target, scale) }}
        />
      )}
    </div>
  );
}

function along(bp: number, scale: number): string {
  return `${String((bp / scale) * 100)}%`;
}
