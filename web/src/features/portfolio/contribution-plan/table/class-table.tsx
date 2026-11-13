import { Button } from "@slotted/react/button";
import { Stack } from "@slotted/react/stack";
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
import styles from "@/features/portfolio/contribution-plan/table/class-table.module.css";
import { NameRequiredMessage } from "@/features/portfolio/contribution-plan/editor/name-required-message";
import { ClassRow } from "@/features/portfolio/contribution-plan/table/class-row";
import type { PlanEditor } from "@/features/portfolio/contribution-plan/editor/use-plan-editor";
import { trackScale } from "@/features/portfolio/contribution-plan/table/track-scale";
import { useT } from "@/i18n/i18n-provider";

type Plan = components["schemas"]["ContributionPlan"];

interface ClassTableProps {
  // Undefined while the plan loads.
  view: Plan | undefined;
  pending: boolean;
  editor?: PlanEditor | undefined;
  memberName: (ref: { account_id?: string; instrument?: string }) => string;
}

// One row per class: name, drift track, target, current, after and the amount to contribute.
export function ClassTable({
  view,
  pending,
  editor,
  memberName,
}: ClassTableProps) {
  const t = useT();
  const [expanded, setExpanded] = useState<readonly string[]>([]);

  const editing = editor?.draft !== undefined;
  const classes = view?.classes ?? [];
  const scale = trackScale(
    classes.flatMap((c) => [c.target_bp, c.share_bp, c.after_share_bp]),
  );

  const nameless = editor?.draft?.classes.some((c) => c.name.trim() === "");

  return (
    <Stack gap={3}>
      <NameRequiredMessage shown={nameless === true} />

      <Table
        columns={editing ? 8 : 7}
        layout="fixed"
        variant="framed"
        loading={pending}
        expanded={expanded}
        onExpandedChange={setExpanded}
      >
        <TableContent aria-label={t("contributionPlan.title")}>
          <TableHead>
            <TableRow>
              <TableColumnHeader text="nowrap" className={styles.colExpand}>
                <VisuallyHidden>
                  {t("contributionPlan.colExpand")}
                </VisuallyHidden>
              </TableColumnHeader>
              <TableColumnHeader text="nowrap">
                {t("contributionPlan.colClass")}
              </TableColumnHeader>
              <TableColumnHeader
                text="nowrap"
                className={editing ? styles.colTrackEdit : undefined}
              >
                <VisuallyHidden>
                  {t("contributionPlan.colTrack")}
                </VisuallyHidden>
              </TableColumnHeader>
              <TableColumnHeader
                text="nowrap"
                numeric
                className={editing ? styles.colTargetEdit : styles.colTarget}
              >
                {t("contributionPlan.colTarget")}
              </TableColumnHeader>
              <TableColumnHeader
                text="nowrap"
                numeric
                className={styles.colShare}
              >
                {t("contributionPlan.colCurrent")}
              </TableColumnHeader>
              <TableColumnHeader
                text="nowrap"
                numeric
                className={styles.colShare}
              >
                {t("contributionPlan.colAfter")}
              </TableColumnHeader>
              <TableColumnHeader
                text="nowrap"
                numeric
                className={styles.colAmount}
              >
                {t("contributionPlan.colAmount")}
              </TableColumnHeader>
              {editing && (
                <TableColumnHeader
                  text="nowrap"
                  sticky="end"
                  className={styles.colActions}
                >
                  <VisuallyHidden>
                    {t("contributionPlan.colActions")}
                  </VisuallyHidden>
                </TableColumnHeader>
              )}
            </TableRow>
          </TableHead>

          {view === undefined && <TableLoader skeletonRows={4} />}

          {view !== undefined && (
            <TableBody>
              {classes.map((cls, index) => (
                <ClassRow
                  key={String(index)}
                  index={index}
                  cls={cls}
                  editor={editor}
                  scale={scale}
                  open={expanded.includes(`class-${String(index)}`)}
                  memberName={memberName}
                />
              ))}
            </TableBody>
          )}
        </TableContent>
      </Table>

      {editor !== undefined && editing && (
        <div>
          <Button
            size="sm"
            variant="ghost"
            tone="secondary"
            onClick={editor.addClass}
          >
            {t("contributionPlan.addClass")}
          </Button>
        </div>
      )}
    </Stack>
  );
}
