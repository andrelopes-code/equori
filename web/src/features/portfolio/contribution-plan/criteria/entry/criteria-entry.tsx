import {
  Section,
  SectionBody,
  SectionDescription,
  SectionHeader,
  SectionHeading,
  SectionTags,
  SectionTitle,
} from "@slotted/react/section";

import type { components } from "@/api/schema.gen";
import { CriteriaHelp } from "@/features/portfolio/contribution-plan/criteria/add/criteria-help";
import { CriteriaEntryRow } from "@/features/portfolio/contribution-plan/criteria/entry/criteria-entry-row";
import styles from "@/features/portfolio/contribution-plan/criteria/entry/criteria-entry.module.css";
import { criteriaGroups } from "@/features/portfolio/contribution-plan/criteria/entry/group-state";
import { useT } from "@/i18n/i18n-provider";

type Plan = components["schemas"]["ContributionPlan"];

interface CriteriaEntryProps {
  view: Plan;
  memberName: (ref: { account_id?: string; instrument?: string }) => string;
  // Opens the board of a group.
  onOpen: (index: number) => void;
}

// The criteria on the main screen: one row per group they are offered for, and the way in. Draws
// nothing without such a group.
export function CriteriaEntry({
  view,
  memberName,
  onOpen,
}: CriteriaEntryProps) {
  const t = useT();

  const groups = criteriaGroups(view.classes);

  if (groups.length === 0) return null;

  return (
    <Section size="lg" ground="surface" heading="title">
      <SectionHeader>
        <SectionTitle>
          <SectionHeading>
            {t("contributionPlan.criteria.title")}
          </SectionHeading>

          <SectionTags>
            <CriteriaHelp />
          </SectionTags>

          <SectionDescription>
            {t("contributionPlan.criteria.description")}
          </SectionDescription>
        </SectionTitle>
      </SectionHeader>

      <SectionBody>
        <ul
          aria-label={t("contributionPlan.criteria.title")}
          className={styles.list}
        >
          {groups.map(({ group, index }) => (
            <CriteriaEntryRow
              key={String(index)}
              group={group}
              index={index}
              memberName={memberName}
              onOpen={() => {
                onOpen(index);
              }}
            />
          ))}
        </ul>
      </SectionBody>
    </Section>
  );
}
