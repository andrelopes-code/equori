import type { CSSProperties } from "react";

import type { PositionState } from "@/features/reports/indicator-series";
import styles from "@/features/reports/range-strip.module.css";
import { useT } from "@/i18n/i18n-provider";

type Strip = Extract<PositionState, { kind: "strip" }>;

export interface RangeStripProps {
  title: string;
  // The asked month's value in basis points.
  value: number;
  state: Strip;
  format: (bp: number) => string;
}

// Where one month stands among the twelve, on one axis: a dot per month, the usual range of the
// other months as a band, the asked month as the large dot. Built under CP-04. Families read: chart
// (a scatter needs two numeric axes inside a card of its own, and its axes cannot line up across
// rows) and sparkline (draws the shape of the series, not the rank of one value among its months).
// Neither draws a position on one axis. Workaround for Slotted issue #93: the app draws the strip
// itself until a family does. Not interactive: the root is named, the drawing is hidden.
export function RangeStrip({ title, value, state, format }: RangeStripProps) {
  const t = useT();
  const name = t(nameKey(state), {
    name: title,
    value: format(value),
    min: format(state.band[0]),
    max: format(state.band[1]),
    mean: format(state.mean ?? 0),
  });
  const crossesZero = state.min < 0 && state.max > 0;

  return (
    <div className={styles.strip} role="img" aria-label={name}>
      {!state.flat && <span className={styles.start}>{format(state.min)}</span>}

      <div className={styles.plane}>
        <span className={styles.rail} />
        <span
          className={styles.band}
          style={vars({
            "--from": percent(state.band[0], state),
            "--to": percent(state.band[1], state),
          })}
        />
        {crossesZero && (
          <span
            className={styles.zero}
            style={vars({ "--at": percent(0, state) })}
          >
            <span className={styles.zeroLabel}>{format(0)}</span>
          </span>
        )}
        {state.dots.map((dot) => (
          <span
            key={dot.index}
            className={styles.dot}
            style={vars({ "--at": percent(dot.bp, state) })}
          />
        ))}
        {state.mean !== null && (
          <span
            className={styles.mean}
            style={vars({ "--at": percent(state.mean, state) })}
          >
            <span className={styles.meanLabel}>
              {t("report.indicators.board.mean", { value: format(state.mean) })}
            </span>
          </span>
        )}
        {!state.markerHidden && (
          <span
            data-asked=""
            className={styles.asked}
            style={vars({ "--at": percent(state.current, state) })}
          />
        )}
      </div>

      {!state.flat && (
        <span className={styles.finish}>{format(state.max)}</span>
      )}
      {state.flat && (
        <span className={styles.note}>
          {t("report.indicators.board.flat", { value: format(state.band[0]) })}
        </span>
      )}
    </div>
  );
}

function nameKey(state: Strip) {
  if (state.mean === null) return "report.indicators.strip.name";

  return state.markerHidden
    ? "report.indicators.strip.nameHidden"
    : "report.indicators.strip.nameMean";
}

// The share of the strip's extent at which a value stands.
function percent(bp: number, state: Strip): string {
  const span = state.max - state.min;
  const share = span === 0 ? 50 : ((bp - state.min) / span) * 100;

  return `${share.toFixed(2)}%`;
}

function vars(values: Record<string, string>): CSSProperties {
  return values;
}
