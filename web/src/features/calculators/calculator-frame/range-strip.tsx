import { barWidths } from "@/features/calculators/calculator-frame/axis";
import styles from "@/features/calculators/calculator-frame/calculator-design.module.css";

interface RangeStripProps {
  low: number;
  mid: number;
  high: number;
  fixed: number;
  max: number;
  // The accessible name of the strip, with its values.
  label: string;
  legend: [string, string, string];
  facts: { term: string; value: string }[];
}

export function RangeStrip({
  low,
  mid,
  high,
  fixed,
  max,
  label,
  legend,
  facts,
}: RangeStripProps) {
  const [start, size, midAt, fixedAt] = barWidths(
    [low, high - low, mid, fixed],
    max,
  );

  return (
    <div className={styles.range} data-part="range">
      <div className={styles.rangeTrack} role="img" aria-label={label}>
        <span
          className={styles.rangeBand}
          style={{ insetInlineStart: start, inlineSize: size }}
        />
        <span className={styles.rangeMid} style={{ insetInlineStart: midAt }} />
        <span
          className={styles.rangeFixed}
          style={{ insetInlineStart: fixedAt }}
        />
      </div>

      <p className={styles.splitLegend}>
        <span className={styles.keyBand} />
        {legend[0]}
        <span className={styles.keyMid} />
        {legend[1]}
        <span className={styles.keyFixed} />
        {legend[2]}
      </p>

      <dl className={styles.rangeFacts}>
        {facts.map((fact) => (
          <div key={fact.term} className={styles.answerFact}>
            <dt>{fact.term}</dt>
            <dd>{fact.value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
