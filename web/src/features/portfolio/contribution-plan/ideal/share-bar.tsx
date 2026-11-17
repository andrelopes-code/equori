import styles from "@/features/portfolio/contribution-plan/ideal/share-bar.module.css";
import { shareText } from "@/features/portfolio/contribution-plan/model/share-text";
import { useAppLocale, useT } from "@/i18n/i18n-provider";
import type { TFunction } from "@/i18n/i18n-provider";
import { cx } from "@/ui/cx";

interface ShareBarProps {
  name: string;
  // Basis points of the whole the bar stands in: the portfolio, or the group for a member.
  today: number;
  // Present only for an entry that receives money.
  after: number | undefined;
  ideal: number | undefined;
  // The position of the group in the plan; it picks the colour of the data palette.
  position: number;
}

const paletteSize = 8;

// The marker label stays inside the bar: near an end it grows away from that end.
const edgeBp = 1200;

// Build-own-element. Families read: progress-indicator, whose role and end mark state a task
// under way; sparkline, which draws a series with no target; chart, which draws a plane with
// axes. None draws a share against its ideal on a scale shared by many rows. The bar fills its
// column and never asks for a width of its own, so it cannot overflow into a neighbour. It holds
// no motion, so reduced motion changes nothing.
export function ShareBar({
  name,
  today,
  after,
  ideal,
  position,
}: ShareBarProps) {
  const t = useT();
  const [tag] = useAppLocale();

  const to = after ?? today;
  const solid = Math.min(today, to);
  const slot = styles[`slot${String((position % paletteSize) + 1)}`];
  const labelEdge = edgeClass(ideal);

  return (
    <div
      role="img"
      aria-label={label(name, today, after, ideal, tag, t)}
      className={cx(styles.bar, slot)}
    >
      <div className={styles.track}>
        <div
          data-part="today"
          className={styles.today}
          style={{ inlineSize: percent(solid) }}
        />

        {after !== undefined && after !== today && (
          <div
            data-part="after"
            className={styles.after}
            style={{
              insetInlineStart: percent(solid),
              inlineSize: percent(Math.abs(after - today)),
            }}
          />
        )}
      </div>

      {ideal !== undefined && (
        <>
          <span
            className={cx(styles.label, labelEdge)}
            style={{ insetInlineStart: percent(ideal) }}
          >
            {t("contributionPlan.markerIdeal", {
              share: shareText(ideal / 10000, tag),
            })}
          </span>

          <div
            data-part="ideal"
            className={styles.marker}
            style={{ insetInlineStart: percent(ideal) }}
          />
        </>
      )}
    </div>
  );
}

function label(
  name: string,
  today: number,
  after: number | undefined,
  ideal: number | undefined,
  tag: string,
  t: TFunction,
): string {
  const vars = {
    name,
    today: shareText(today / 10000, tag),
    after: shareText((after ?? 0) / 10000, tag),
    ideal: shareText((ideal ?? 0) / 10000, tag),
  };
  if (ideal === undefined) return t("contributionPlan.barLabelNoIdeal", vars);

  return t(
    after === undefined
      ? "contributionPlan.barLabel"
      : "contributionPlan.barLabelAfter",
    vars,
  );
}

function edgeClass(ideal: number | undefined): string {
  if (ideal === undefined) return "";
  if (ideal < edgeBp) return styles.labelStart ?? "";

  return ideal > 10000 - edgeBp ? (styles.labelEnd ?? "") : "";
}

function percent(bp: number): string {
  return `${String(bp / 100)}%`;
}
