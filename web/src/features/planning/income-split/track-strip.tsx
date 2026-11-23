import { TrackStripPart } from "@/features/planning/income-split/track-strip-part";
import type { StripPart } from "@/features/planning/income-split/track-strip-parts";
import styles from "@/features/planning/income-split/track-strip.module.css";
import { useT } from "@/i18n/i18n-provider";

interface TrackStripProps {
  parts: readonly StripPart[];
  // The income received the parts sum to, written.
  received: string;
  // The yields that stayed in the investments, outside the income received (A252).
  retained: number;
  // The name of the month on screen.
  month: string;
  money: (amount: number) => string;
  onOutside: () => void;
}

// The month as one strip that sums to the income received: where each part of it went
// (planning coherence section 6). Families read: chart, progress-bar, meter. None draws a
// part-to-whole line with a written legend; the bar is the app's own, decorative, and the
// legend carries every figure in words. The retained yields stand last in the legend, with no
// segment.
export function TrackStrip({
  parts,
  received,
  retained,
  month,
  money,
  onOutside,
}: TrackStripProps) {
  const t = useT();

  if (parts.length === 0) return null;

  return (
    <div
      className={styles.strip}
      role="group"
      aria-label={t("track.strip.label", { amount: received })}
    >
      <div className={styles.bar} aria-hidden="true">
        {parts
          .filter((p) => p.shareBp > 0)
          .map((p) => (
            <span
              key={p.key}
              className={styles.segment}
              data-part-key={p.key}
              style={{ flexGrow: p.shareBp }}
            />
          ))}
      </div>

      <dl className={styles.legend}>
        {parts.map((p) => (
          <TrackStripPart
            key={p.key}
            part={p.key}
            amount={p.amount}
            month={month}
            money={money}
            onOutside={onOutside}
          />
        ))}

        {retained > 0 && (
          <TrackStripPart
            part="retained"
            amount={retained}
            month={month}
            money={money}
            onOutside={onOutside}
          />
        )}
      </dl>
    </div>
  );
}
