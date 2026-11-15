import { useId } from "react";

import { AnswerBlockFrame } from "@/features/assistant/message/answer-block-frame";
import type { SeriesRow } from "@/features/assistant/message/answer-blocks";
import styles from "@/features/assistant/message/answer-blocks.module.css";
import {
  seriesBox,
  seriesGeometry,
} from "@/features/assistant/message/series-geometry";
import { useT } from "@/i18n/i18n-provider";

interface SeriesBlockProps {
  head: [string, string];
  rows: SeriesRow[];
}

// A balance over time: a step line, the lowest point marked and written, the zero line when the
// range reaches it.
export function SeriesBlock({ head, rows }: SeriesBlockProps) {
  const t = useT();
  const fillId = useId();

  const { width, height, left, right } = seriesBox;
  const geometry = seriesGeometry(rows);

  if (geometry === undefined) return null;

  const { low, last } = geometry;

  return (
    <AnswerBlockFrame icon="chart" head={head} rows={rows}>
      <svg
        className={styles.series}
        viewBox={`0 0 ${String(width)} ${String(height)}`}
      >
        <defs>
          <linearGradient id={fillId} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" className={styles.fillTop} />
            <stop offset="1" className={styles.fillBottom} />
          </linearGradient>
        </defs>

        {geometry.zeroY !== undefined && (
          <line
            className={styles.zeroLine}
            x1={left}
            x2={right}
            y1={geometry.zeroY}
            y2={geometry.zeroY}
          />
        )}

        <path d={geometry.area} fill={`url(#${fillId})`} />
        <path className={styles.line} d={geometry.line} pathLength={1} />

        <circle className={styles.low} cx={low.x} cy={low.y} r={4.5} />
        <text
          className={styles.lowText}
          x={low.x}
          y={low.y - 10}
          textAnchor="middle"
        >
          {t("assistant.block.lowest", { value: low.text })}
        </text>

        <circle className={styles.endPoint} cx={last.x} cy={last.y} r={4} />

        {geometry.labels.map((label) => (
          <text
            key={label.index}
            className={styles.axisLabel}
            x={label.x}
            y={height - 6}
            textAnchor={label.anchor}
          >
            {label.text}
          </text>
        ))}
      </svg>
    </AnswerBlockFrame>
  );
}
