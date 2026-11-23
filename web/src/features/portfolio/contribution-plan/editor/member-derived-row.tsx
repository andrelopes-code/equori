import { Text } from "@slotted/react/typography";

import type { components } from "@/api/schema.gen";
import styles from "@/features/portfolio/contribution-plan/editor/edit-list.module.css";
import { ReceivedAmount } from "@/features/portfolio/contribution-plan/editor/received-amount";
import { RemoveButton } from "@/features/portfolio/contribution-plan/editor/remove-button";
import { TodayShare } from "@/features/portfolio/contribution-plan/editor/today-share";
import type { PlanEditor } from "@/features/portfolio/contribution-plan/editor/use-plan-editor";
import { shareText } from "@/features/portfolio/contribution-plan/model/share-text";
import { useAppLocale, useT } from "@/i18n/i18n-provider";

type Member = components["schemas"]["ContributionMember"];

interface MemberDerivedRowProps {
  index: number;
  at: number;
  member: Member;
  name: string;
  // Whether the criteria give the group an ideal per asset.
  ideals: boolean;
  editor: PlanEditor;
}

// An asset of a group divided by criteria: its derived ideal is read here and set on the board.
export function MemberDerivedRow({
  index,
  at,
  member,
  name,
  ideals,
  editor,
}: MemberDerivedRowProps) {
  const t = useT();
  const [locale] = useAppLocale();

  const bp = ideals ? member.target_bp : undefined;

  return (
    <div role="listitem" className={styles.row}>
      <Text size="md" className={styles.member}>
        {name}
      </Text>

      <Text size="sm" tone="muted" className={styles.derived}>
        {bp === undefined
          ? ""
          : t("contributionPlan.markerIdeal", {
              share: shareText(bp / 10000, locale),
            })}
      </Text>

      <TodayShare bp={member.share_bp ?? 0} />

      <ReceivedAmount amount={member.cost ?? member.amount} />

      <div className={styles.actions}>
        <RemoveButton
          label={t("contributionPlan.removeMember")}
          onRemove={() => {
            editor.removeMember(index, at);
          }}
        />
      </div>
    </div>
  );
}
