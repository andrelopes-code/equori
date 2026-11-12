import {
  Table,
  TableBody,
  TableColumnHeader,
  TableContent,
  TableHead,
  TableLoader,
  TableRow,
} from "@slotted/react/table";
import { VisuallyHidden } from "@slotted/react/visually-hidden";
import { useState } from "react";

import type { components } from "@/api/schema.gen";
import { ClassRow } from "@/features/portfolio/contribution-plan/class-row";
import { trackScale } from "@/features/portfolio/contribution-plan/track-scale";
import { useT } from "@/i18n/i18n-provider";

type Plan = components["schemas"]["ContributionPlan"];

interface ClassTableProps {
  // Undefined while the plan loads.
  view: Plan | undefined;
  pending: boolean;
  memberName: (ref: { account_id?: string; instrument?: string }) => string;
}

const columns = 7;

// One row per class: name, drift track, target, current, after and the amount to contribute.
export function ClassTable({ view, pending, memberName }: ClassTableProps) {
  const t = useT();
  const [expanded, setExpanded] = useState<readonly string[]>([]);

  const classes = view?.classes ?? [];
  const scale = trackScale(
    classes.flatMap((c) => [c.target_bp, c.share_bp, c.after_share_bp]),
  );

  return (
    <Table
      columns={columns}
      variant="framed"
      loading={pending}
      expanded={expanded}
      onExpandedChange={setExpanded}
    >
      <TableContent aria-label={t("contributionPlan.title")}>
        <TableHead>
          <TableRow>
            <TableColumnHeader>
              <VisuallyHidden>{t("contributionPlan.colExpand")}</VisuallyHidden>
            </TableColumnHeader>
            <TableColumnHeader>
              {t("contributionPlan.colClass")}
            </TableColumnHeader>
            <TableColumnHeader>
              <VisuallyHidden>{t("contributionPlan.colTrack")}</VisuallyHidden>
            </TableColumnHeader>
            <TableColumnHeader numeric>
              {t("contributionPlan.colTarget")}
            </TableColumnHeader>
            <TableColumnHeader numeric>
              {t("contributionPlan.colCurrent")}
            </TableColumnHeader>
            <TableColumnHeader numeric>
              {t("contributionPlan.colAfter")}
            </TableColumnHeader>
            <TableColumnHeader numeric>
              {t("contributionPlan.colAmount")}
            </TableColumnHeader>
          </TableRow>
        </TableHead>

        {view === undefined && <TableLoader skeletonRows={4} />}

        {view !== undefined && (
          <TableBody>
            {classes.map((cls, index) => (
              <ClassRow
                key={cls.name}
                index={index}
                cls={cls}
                scale={scale}
                open={expanded.includes(`class-${String(index)}`)}
                memberName={memberName}
              />
            ))}
          </TableBody>
        )}
      </TableContent>
    </Table>
  );
}
