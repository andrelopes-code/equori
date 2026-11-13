import {
  Section,
  SectionActions,
  SectionBody,
  SectionHeader,
  SectionHeading,
  SectionTitle,
} from "@slotted/react/section";
import { Skeleton } from "@slotted/react/skeleton";
import { Stack } from "@slotted/react/stack";
import { useState } from "react";

import type { components } from "@/api/schema.gen";
import { BarKey } from "@/features/portfolio/contribution-plan/ideal/bar-key";
import { GroupRow } from "@/features/portfolio/contribution-plan/ideal/group-row";
import styles from "@/features/portfolio/contribution-plan/ideal/ideal-grid.module.css";
import { ScaleHeader } from "@/features/portfolio/contribution-plan/ideal/scale-header";
import { positive } from "@/features/portfolio/contribution-plan/model/shopping-list";
import { useT } from "@/i18n/i18n-provider";

type Plan = components["schemas"]["ContributionPlan"];

interface IdealSectionProps {
  // Undefined while the plan loads.
  view: Plan | undefined;
  pending: boolean;
  memberName: (ref: { account_id?: string; instrument?: string }) => string;
  // Enters edit mode, where a group splits its target among its assets.
  onEdit: () => void;
}

// One row per group, then the members of an open group (spec, Screen, Portfolio against the
// ideal).
export function IdealSection({
  view,
  pending,
  memberName,
  onEdit,
}: IdealSectionProps) {
  const t = useT();
  const [open, setOpen] = useState<readonly number[]>([]);

  const groups = view?.classes ?? [];
  const hasAmount = view?.amount !== undefined;
  const waiting = view?.status === "incomplete";
  const withAfter = groups.some(
    (g) => positive(g.amount) || g.members.some((m) => positive(m.amount)),
  );

  function handleToggle(index: number) {
    setOpen((now) =>
      now.includes(index) ? now.filter((i) => i !== index) : [...now, index],
    );
  }

  return (
    <Section size="lg" ground="surface" aria-busy={pending}>
      <SectionHeader>
        <SectionTitle>
          <SectionHeading>{t("contributionPlan.ideal")}</SectionHeading>
        </SectionTitle>

        <SectionActions>
          <BarKey withAfter={withAfter} />
        </SectionActions>
      </SectionHeader>

      <SectionBody>
        <Stack gap={3}>
          {view === undefined && (
            <Stack gap={2}>
              {[0, 1, 2, 3].map((n) => (
                <Skeleton key={n} shape="block" blockSize="3.25rem" />
              ))}
            </Stack>
          )}

          {view !== undefined && (
            <div
              role="list"
              aria-label={t("contributionPlan.ideal")}
              className={styles.grid}
            >
              <ScaleHeader />

              {groups.map((group, index) => (
                <GroupRow
                  key={String(index)}
                  index={index}
                  group={group}
                  open={open.includes(index)}
                  hasAmount={hasAmount}
                  waiting={waiting}
                  memberName={memberName}
                  onToggle={() => {
                    handleToggle(index);
                  }}
                  onSplit={onEdit}
                />
              ))}
            </div>
          )}
        </Stack>
      </SectionBody>
    </Section>
  );
}
