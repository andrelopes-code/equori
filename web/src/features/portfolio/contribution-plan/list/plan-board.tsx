import { Text } from "@slotted/react/typography";
import { useQuery } from "@tanstack/react-query";

import { useApi } from "@/api/api-context";
import type { components } from "@/api/schema.gen";
import type { ListSections } from "@/features/portfolio/contribution-plan/list/list-rows";
import { PlanList } from "@/features/portfolio/contribution-plan/list/plan-list";
import styles from "@/features/portfolio/contribution-plan/list/plan-list.module.css";
import type { useOpenRow } from "@/features/portfolio/contribution-plan/list/use-open-row";
import { AssetPanel } from "@/features/portfolio/contribution-plan/panel/asset-panel";
import { meQuery } from "@/features/session";
import { useT } from "@/i18n/i18n-provider";
import { cx } from "@/ui/cx";

type Plan = components["schemas"]["ContributionPlan"];

interface PlanBoardProps {
  // The plan stored, and the plan split by the amount.
  plan: Plan;
  view: Plan;
  sections: ListSections;
  opened: ReturnType<typeof useOpenRow>;
  memberName: (ref: { account_id?: string; instrument?: string }) => string;
  onSplit: (group: number) => void;
}

// The list of the assets and, beside it, the panel of the one chosen.
export function PlanBoard({
  plan,
  view,
  sections,
  opened,
  memberName,
  onSplit,
}: PlanBoardProps) {
  const t = useT();
  const api = useApi();
  const role = useQuery(meQuery(api)).data?.book_role;

  const { row } = opened;

  return (
    <>
      {view.holds_ignored && (
        <Text size="sm" tone="muted">
          {t("contributionPlan.list.holdsIgnored")}
        </Text>
      )}

      <div className={cx(styles.split, row !== undefined && styles.withPanel)}>
        <PlanList
          view={view}
          sections={sections}
          openKey={row?.key}
          onOpen={opened.onOpen}
        />

        {row !== undefined && (
          <AssetPanel
            key={row.key}
            row={row}
            plan={plan}
            view={view}
            readOnly={role === "read"}
            asked={opened.asked}
            memberName={memberName}
            onClose={opened.onClose}
            onSplit={onSplit}
          />
        )}
      </div>
    </>
  );
}
