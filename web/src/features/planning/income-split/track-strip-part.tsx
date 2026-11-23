import { Button } from "@slotted/react/button";
import { Link } from "@slotted/react/link";
import { Text } from "@slotted/react/typography";

import { stripHelp } from "@/features/planning/income-split/track-strip-parts";
import type { StripKey } from "@/features/planning/income-split/track-strip-parts";
import styles from "@/features/planning/income-split/track-strip.module.css";
import { useT } from "@/i18n/i18n-provider";
import { HelpTip } from "@/ui/display/help-tip";
import { routeTo } from "@/ui/navigation/route-to";

interface TrackStripPartProps {
  // A part of the strip, or the retained yields, which the bar does not draw.
  part: StripKey | "retained";
  amount: number;
  // The name of the month on screen.
  month: string;
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

// One term of the strip's legend with its amount. The spending outside the split opens its
// entries; a term whose meaning a reader may not know carries its explanation.
export function TrackStripPart({
  part,
  amount,
  month,
  money,
  onOutside,
}: TrackStripPartProps) {
  const t = useT();
  const name = t(names[part]);
  const to = links[part];
  const help = stripHelp(part, amount);

  return (
    <div className={styles.part} data-part-key={part}>
      <span className={styles.swatch} aria-hidden="true" />
      <Text size="sm" tone="muted" render={(props) => <dt {...props} />}>
        {to !== undefined && <Link render={routeTo({ to })}>{name}</Link>}
        {part === "outside" && (
          <Button inline onClick={onOutside}>
            {name}
          </Button>
        )}
        {to === undefined && part !== "outside" && name}
        {help !== undefined && (
          <HelpTip
            label={t("return.help.about", { term: name })}
            text={t(help, { amount: money(Math.abs(amount)), month })}
          />
        )}
      </Text>
      <Text
        size="sm"
        weight="medium"
        numeric="tabular"
        render={(props) => <dd {...props} />}
      >
        {money(amount)}
      </Text>
    </div>
  );
}
