import { Text } from "@slotted/react/typography";

import type { components } from "@/api/schema.gen";
import { AssetFacts } from "@/features/instruments";
import styles from "@/features/portfolio/contribution-plan/editor/edit-list.module.css";
import { factsPrefix } from "@/features/portfolio/contribution-plan/model/fact-labels";
import { useAppLocale, useT } from "@/i18n/i18n-provider";

type Member = components["schemas"]["ContributionMember"];

interface MemberFactsLineProps {
  member: Member;
  // One fact key per question, "" for the investor's own.
  facts: string[];
}

// The facts line of an asset: the fiscal year of the signals (or their absence), then the figures
// of its reports. An account has no reports.
export function MemberFactsLine({ member, facts }: MemberFactsLineProps) {
  const t = useT();
  const [tag] = useAppLocale();

  if (member.instrument === undefined) {
    return (
      <Text size="sm" tone="muted" truncate>
        {t("contributionPlan.questions.noFacts")}
      </Text>
    );
  }

  const prefix = factsPrefix(t, tag, member.facts_year, facts);

  return (
    <div className={styles.factsLine}>
      {prefix !== "" && (
        <Text size="sm" tone="muted" truncate title={prefix}>
          {prefix}
        </Text>
      )}

      <AssetFacts code={member.instrument} />
    </div>
  );
}
