import { Button } from "@slotted/react/button";
import { Glyph } from "@slotted/react/icon";
import { Text } from "@slotted/react/typography";

import type { components } from "@/api/schema.gen";
import { GroupAnswer } from "@/features/portfolio/contribution-plan/panel/group-answer";
import {
  type CriterionView,
  answerCounts,
} from "@/features/portfolio/contribution-plan/panel/model/criterion-view";
import {
  criterionTitle,
  settingsText,
} from "@/features/portfolio/contribution-plan/panel/model/criterion-words";
import styles from "@/features/portfolio/contribution-plan/panel/panel.module.css";
import type { Criteria } from "@/features/portfolio/contribution-plan/panel/use-criteria";
import { useAppLocale, useT } from "@/i18n/i18n-provider";
import { cx } from "@/ui/cx";

type Group = components["schemas"]["ContributionClass"];

interface GroupCriterionProps {
  cls: Group;
  criterion: CriterionView;
  open: boolean;
  criteria: Criteria;
  readOnly: boolean;
  memberName: (ref: { account_id?: string; instrument?: string }) => string;
  onToggle: () => void;
  onEdit: () => void;
}

// A criterion over the assets of its group: the counts while it is closed, one answer per asset while it
// is open.
export function GroupCriterion({
  cls,
  criterion,
  open,
  criteria,
  readOnly,
  memberName,
  onToggle,
  onEdit,
}: GroupCriterionProps) {
  const t = useT();
  const [locale] = useAppLocale();

  const title = criterionTitle(locale, criterion);
  const counts = answerCounts(cls, criterion);
  const summary = criterion.counts
    ? t("contributionPlan.panel.counts", {
        yes: String(counts.yes),
        no: String(counts.no),
        none: String(counts.none),
      })
    : t("contributionPlan.panel.noLimit");

  return (
    <li className={cx(styles.cond, !open && styles.shut)}>
      <button
        type="button"
        className={styles.shutHead}
        aria-expanded={open}
        onClick={onToggle}
      >
        <span className={styles.chevron}>
          <Glyph name={open ? "chevron-down" : "chevron-right"} />
        </span>

        <Text size="md" className={styles.shutQuestion}>
          {title}
        </Text>

        <Text size="xs" tone="muted">
          {summary}
        </Text>
      </button>

      {open && (
        <>
          <div className={styles.answers}>
            {cls.members.map((member, at) => (
              <GroupAnswer
                key={member.instrument ?? member.account_id ?? at}
                cls={cls}
                member={member}
                name={memberName(member)}
                criterion={criterion}
                criteria={criteria}
                readOnly={readOnly}
              />
            ))}
          </div>

          <div className={styles.condMeta}>
            <Text size="xs" tone="muted">
              {settingsText(t, criterion)}
            </Text>

            <span className={styles.grow} />

            {!readOnly && (
              <Button
                size="sm"
                variant="ghost"
                tone="secondary"
                aria-label={t("contributionPlan.panel.editNamed", {
                  name: title,
                })}
                onClick={onEdit}
              >
                {t("contributionPlan.panel.edit")}
              </Button>
            )}
          </div>
        </>
      )}
    </li>
  );
}
