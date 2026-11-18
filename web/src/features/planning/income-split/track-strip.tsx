import { Link } from "@slotted/react/link";
import { Text } from "@slotted/react/typography";

import type {
  StripKey,
  StripPart,
} from "@/features/planning/income-split/track-strip-parts";
import styles from "@/features/planning/income-split/track-strip.module.css";
import { useT } from "@/i18n/i18n-provider";
import { routeTo } from "@/ui/navigation/route-to";

interface TrackStripProps {
  parts: readonly StripPart[];
  // The income received the parts sum to, written.
  received: string;
  money: (amount: number) => string;
}

const names = {
  spent: "track.strip.spent",
  setAside: "track.strip.setAside",
  goalDeposits: "track.strip.goalDeposits",
  outside: "track.strip.outside",
  unallocated: "track.strip.unallocated",
} as const;

// The screen that plans a part: the contribution plan for what was set aside, the goals for
// their deposits.
const links: Partial<
  Record<StripKey, "/portfolio/contribution-plan" | "/goals">
> = {
  setAside: "/portfolio/contribution-plan",
  goalDeposits: "/goals",
};

// The month as one strip that sums to the income received: where each part of it went
// (planning coherence section 6). Families read: chart, progress-bar, meter. None draws a
// part-to-whole line with a written legend; the bar is the app's own, decorative, and the
// legend carries every figure in words.
export function TrackStrip({ parts, received, money }: TrackStripProps) {
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
        {parts.map((p) => {
          const to = links[p.key];

          return (
            <div key={p.key} className={styles.part} data-part-key={p.key}>
              <span className={styles.swatch} aria-hidden="true" />
              <Text
                size="sm"
                tone="muted"
                render={(props) => <dt {...props} />}
              >
                {to === undefined && t(names[p.key])}
                {to !== undefined && (
                  <Link render={routeTo({ to })}>{t(names[p.key])}</Link>
                )}
              </Text>
              <Text
                size="sm"
                weight="medium"
                numeric="tabular"
                render={(props) => <dd {...props} />}
              >
                {money(p.amount)}
              </Text>
            </div>
          );
        })}
      </dl>
    </div>
  );
}
