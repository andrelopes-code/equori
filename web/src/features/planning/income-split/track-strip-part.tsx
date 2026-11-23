import { Button } from "@slotted/react/button";
import { Link } from "@slotted/react/link";
import { Text } from "@slotted/react/typography";

import { stripNote } from "@/features/planning/income-split/track-strip-parts";
import type { StripKey } from "@/features/planning/income-split/track-strip-parts";
import styles from "@/features/planning/income-split/track-strip.module.css";
import { useShareText } from "@/features/planning/income-split/use-share-text";
import { useT } from "@/i18n/i18n-provider";
import { routeTo } from "@/ui/navigation/route-to";

interface TrackStripPartProps {
  // A part of the strip, or the retained yields, which the bar does not draw.
  part: StripKey | "retained";
  amount: number;
  // The income received in the month: the base of the share.
  received: number;
  money: (amount: number) => string;
  onOutside: () => void;
}

const names = {
  spent: "track.strip.spent",
  setAside: "track.strip.setAside",
  goalDeposits: "track.strip.goalDeposits",
  outside: "track.strip.outside",
  unallocated: "track.strip.unallocated",
  retained: "track.strip.retained",
} as const;

// The screen that plans a part: the contribution plan for what was set aside, the goals for
// their deposits.
const links: Partial<
  Record<TrackStripPartProps["part"], "/portfolio/contribution-plan" | "/goals">
> = {
  setAside: "/portfolio/contribution-plan",
  goalDeposits: "/goals",
};

// One figure of the strip: its name with the key of its segment, its amount, and the line that
// says what it counts. The spending outside the split opens its entries.
export function TrackStripPart({
  part,
  amount,
  received,
  money,
  onOutside,
}: TrackStripPartProps) {
  const t = useT();
  const share = useShareText();
  const name = t(names[part]);
  const to = links[part];
  const opens = to !== undefined || part === "outside";
  const note = stripNote(part, amount, received);

  return (
    <div className={styles.part} data-part-key={part}>
      <Text
        size="sm"
        tone={opens ? "default" : "muted"}
        className={styles.name}
        render={(props) => <dt {...props} />}
      >
        <span className={styles.swatch} aria-hidden="true" />
        {to !== undefined && (
          <Link variant="neutral" render={routeTo({ to })}>
            {name}
          </Link>
        )}
        {part === "outside" && (
          <Button inline tone="secondary" onClick={onOutside}>
            {name}
          </Button>
        )}
        {!opens && name}
      </Text>

      <Text
        size="md"
        weight="semibold"
        numeric="tabular"
        render={(props) => <dd {...props} />}
      >
        {money(amount)}
      </Text>

      <Text
        size="xs"
        tone="muted"
        numeric="tabular"
        render={(props) => <dd {...props} />}
      >
        {t(note.key, {
          share: note.shareBp === undefined ? "" : share(note.shareBp),
        })}
      </Text>
    </div>
  );
}
