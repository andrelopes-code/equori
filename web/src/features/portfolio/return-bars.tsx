import { Glyph, Icon } from "@slotted/react/icon";
import { Stack } from "@slotted/react/stack";
import { Tag } from "@slotted/react/tag";
import { Text } from "@slotted/react/typography";

import { formatBasisPoints, numberFormatter } from "@/i18n/format";
import { useAppLocale, useT } from "@/i18n/i18n-provider";

import {
  axisPosition,
  type ReturnAxis,
} from "@/features/portfolio/return-axis";
import styles from "@/features/portfolio/return-bars.module.css";
import type {
  ReturnChip,
  ReturnComparison,
} from "@/features/portfolio/return-summary";

const chipGlyph = {
  up: "arrow-up",
  down: "arrow-down",
  equal: "minus",
  check: "check",
} as const satisfies Record<ReturnChip["icon"], string>;

const chipTone = {
  success: "success",
  danger: "danger",
  neutral: "secondary",
} as const satisfies Record<ReturnChip["tone"], string>;

interface ReturnBarsProps {
  comparisons: ReturnComparison[];
  axis: ReturnAxis;
}

// Workaround for Slotted issue #88: no family draws two values compared as bars on one signed
// axis. Families read: chart, which draws one fill per series and no domain shared across two
// blocks, and progress-indicator, whose role and end mark state a task under way. The pair of
// bars is one image named by its two values, so the rows hold no role of their own.
export function ReturnBars({ comparisons, axis }: ReturnBarsProps) {
  const t = useT();
  const [tag] = useAppLocale();

  const tickFormat = numberFormatter(tag, { maximumFractionDigits: 0 });
  const tickLabels = axis.ticks.map((tick) => ({
    tick,
    label: `${tickFormat.format(tick / 100)}%`,
  }));

  return (
    <div className={styles.bars}>
      {comparisons.map((comparison) => (
        <div key={comparison.key} className={styles.block}>
          <div className={styles.head}>
            <Stack gap={0} className={styles.headText}>
              <Text weight="semibold">{comparison.heading}</Text>
              <Text size="sm" tone="muted">
                {comparison.window}
              </Text>
            </Stack>

            {comparison.chip && (
              <Tag
                size="sm"
                className={styles.chip}
                tone={chipTone[comparison.chip.tone]}
                start={
                  <Icon size="sm">
                    <Glyph name={chipGlyph[comparison.chip.icon]} />
                  </Icon>
                }
              >
                {comparison.chip.text}
              </Tag>
            )}
          </div>

          <div
            role="img"
            className={styles.pair}
            aria-label={t("return.bars.label", {
              subject: comparison.bars[0].label,
              value: formatBasisPoints(comparison.bars[0].bp, tag),
              index: comparison.bars[1].label,
              indexValue: formatBasisPoints(comparison.bars[1].bp, tag),
            })}
          >
            {comparison.bars.map((bar) => {
              const geometry = barGeometry(axis, bar.bp);

              return (
                <div key={bar.key} className={styles.row}>
                  <Text size="sm">{bar.label}</Text>
                  <div className={styles.track}>
                    <div
                      className={styles.zero}
                      style={{ insetInlineStart: `${String(geometry.zero)}%` }}
                    />
                    <div
                      data-bar={bar.key}
                      className={[styles.bar, styles[bar.key]].join(" ")}
                      style={{
                        insetInlineStart: `${String(geometry.start)}%`,
                        inlineSize: `${String(geometry.size)}%`,
                      }}
                    />
                    <Text
                      size="sm"
                      weight="semibold"
                      numeric="tabular"
                      className={[
                        styles.value,
                        bar.bp < 0 ? styles.before : styles.after,
                      ].join(" ")}
                      style={{ [geometry.anchor]: `${String(geometry.edge)}%` }}
                    >
                      {formatBasisPoints(bar.bp, tag)}
                    </Text>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}

      <div className={styles.ticks} aria-hidden="true">
        {tickLabels.map(({ tick, label }) => (
          <Text
            key={tick}
            size="xs"
            tone="muted"
            numeric="tabular"
            className={styles.tick}
            style={{ insetInlineStart: `${String(axisPosition(axis, tick))}%` }}
          >
            {label}
          </Text>
        ))}
      </div>
    </div>
  );
}

interface BarGeometry {
  // Percent along the track of the zero line, of the bar's start and of the bar's length.
  zero: number;
  start: number;
  size: number;
  // The side the value is anchored on and the percent from it: right of a positive bar's end,
  // left of a negative bar's start.
  anchor: "insetInlineStart" | "insetInlineEnd";
  edge: number;
}

function barGeometry(axis: ReturnAxis, bp: number): BarGeometry {
  const zero = axisPosition(axis, 0);
  const size = (Math.abs(bp) * 100) / (axis.max - axis.min);

  if (bp < 0) {
    return {
      zero,
      start: zero - size,
      size,
      anchor: "insetInlineEnd",
      edge: 100 - (zero - size),
    };
  }

  return {
    zero,
    start: zero,
    size,
    anchor: "insetInlineStart",
    edge: zero + size,
  };
}
