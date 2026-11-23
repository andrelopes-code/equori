import { Button } from "@slotted/react/button";
import { Text } from "@slotted/react/typography";

import type { components } from "@/api/schema.gen";
import styles from "@/features/portfolio/contribution-plan/criteria/entry/criteria-entry.module.css";
import { groupStateText } from "@/features/portfolio/contribution-plan/criteria/entry/group-state";
import { IdealStrip } from "@/features/portfolio/contribution-plan/criteria/entry/ideal-strip";
import { shareText } from "@/features/portfolio/contribution-plan/model/share-text";
import { GroupDot } from "@/features/portfolio/contribution-plan/month/group-dot";
import { useAppLocale, useT } from "@/i18n/i18n-provider";

type Group = components["schemas"]["ContributionClass"];

interface CriteriaEntryRowProps {
  group: Group;
  // The position of the group in the plan.
  index: number;
  memberName: (ref: { account_id?: string; instrument?: string }) => string;
  onOpen: () => void;
}

// A group the criteria are offered for: how its ideals are set, the ideals derived and the way in.
export function CriteriaEntryRow({
  group,
  index,
  memberName,
  onOpen,
}: CriteriaEntryRowProps) {
  const t = useT();
  const [locale] = useAppLocale();

  const used = group.questions.length > 0;
  const parts = group.question_ideals
    ? group.members
        .map((m) => ({
          name: memberName(m),
          share: (m.target_bp ?? 0) / 10000,
          text: shareText((m.target_bp ?? 0) / 10000, locale),
        }))
        .filter((part) => part.share > 0)
        .sort((a, b) => b.share - a.share)
    : [];

  return (
    <li className={styles.row}>
      <span className={styles.name}>
        <GroupDot position={index} />

        <Text size="md" truncate title={group.name}>
          {group.name}
        </Text>
      </span>

      <Text size="sm" tone="muted" truncate>
        {groupStateText(t, group)}
      </Text>

      <Button
        className={styles.action}
        size="sm"
        variant="outline"
        tone="secondary"
        aria-label={t(
          used
            ? "contributionPlan.criteria.openOf"
            : "contributionPlan.criteria.useIn",
          { name: group.name },
        )}
        onClick={onOpen}
      >
        {t(
          used
            ? "contributionPlan.criteria.open"
            : "contributionPlan.criteria.use",
        )}
      </Button>

      {parts.length > 0 && <IdealStrip parts={parts} />}
    </li>
  );
}
