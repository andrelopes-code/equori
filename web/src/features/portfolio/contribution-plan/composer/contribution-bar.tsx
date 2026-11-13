import styles from "@/features/portfolio/contribution-plan/composer/composition-editor.module.css";
import type { CompositionGroup } from "@/features/portfolio/contribution-plan/composer/composition-group";
import { ContributionLabel } from "@/features/portfolio/contribution-plan/composer/contribution-label";
import { slotClass } from "@/features/portfolio/contribution-plan/composer/slot-class";
import { useBarWidth } from "@/features/portfolio/contribution-plan/composer/use-bar-width";
import { useHeldSplit } from "@/features/portfolio/contribution-plan/composer/use-held-split";
import { useScale } from "@/features/setup";
import { useT } from "@/i18n/i18n-provider";
import { useMoneyFormat } from "@/privacy/use-money-format";

interface ContributionBarProps {
  groups: CompositionGroup[];
  pending: boolean;
  state: "ok" | "noAmount" | "nameMissing";
}

interface Part {
  key: string;
  name: string;
  colour: number;
  minor: number;
  currency: string;
}

// The contribution split among the groups that receive money, with the amount under each segment
// that has room. A pending preview keeps the previous split on screen.
export function ContributionBar({
  groups,
  pending,
  state,
}: ContributionBarProps) {
  const t = useT();
  const fmt = useMoneyFormat();
  const scale = useScale();
  const [barWidth, barRef] = useBarWidth();

  const parts = useHeldSplit(partsOf(groups), pending);
  const message = trackMessage(state);
  const money = (part: Part) =>
    fmt.money(
      { amount: part.minor, currency: part.currency },
      scale?.(part.currency) ?? 0,
    );
  const summary =
    message === undefined
      ? parts.map((p) => `${p.name} ${money(p)}`).join(", ")
      : t(message);

  return (
    <div
      role="img"
      aria-label={`${t("contributionPlan.barContribution")}: ${summary}`}
      aria-busy={pending}
      className={styles.contribution}
    >
      <div
        data-bar="contribution"
        ref={barRef}
        className={[styles.thinBar, styles.segments].join(" ")}
      >
        {message !== undefined && (
          <span className={styles.trackMessage}>{t(message)}</span>
        )}

        {message === undefined &&
          parts.map((part) => (
            <div
              key={part.key}
              data-segment=""
              className={[styles.segment, slotClass(part.colour)].join(" ")}
              style={{ flexGrow: part.minor }}
            />
          ))}
      </div>

      <div className={styles.labelLine}>
        {message === undefined &&
          parts.map((part) => (
            <ContributionLabel
              key={part.key}
              text={money(part)}
              weight={part.minor}
              barWidth={barWidth}
            />
          ))}
      </div>
    </div>
  );
}

function partsOf(groups: CompositionGroup[]): Part[] {
  return groups.flatMap((g) =>
    g.amount === undefined || g.amount.amount <= 0
      ? []
      : [
          {
            key: g.key,
            name: g.name,
            colour: g.colour,
            minor: g.amount.amount,
            currency: g.amount.currency,
          },
        ],
  );
}

function trackMessage(state: ContributionBarProps["state"]) {
  if (state === "noAmount") return "contributionPlan.barNoAmount";
  if (state === "nameMissing") return "contributionPlan.barNameMissing";

  return undefined;
}
