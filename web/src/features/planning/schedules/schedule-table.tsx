import {
  Table,
  TableBody,
  TableCaption,
  TableColumnHeader,
  TableContent,
  TableGroupRow,
  TableHead,
  TableLoader,
  TableRow,
} from "@slotted/react/table";
import { Fragment } from "react";

import type { components } from "@/api/schema.gen";
import { HiddenCaption } from "@/features/planning/hidden-caption/hidden-caption";
import { ScheduleRow } from "@/features/planning/schedules/schedule-row";
import { useT } from "@/i18n/i18n-provider";

type Schedule = components["schemas"]["Schedule"];

export interface ScheduleGroup {
  key: string;
  // A group without a label draws no group row.
  label?: string;
  // What the group row writes at its end: the kind's monthly total.
  end?: string | undefined;
  schedules: readonly Schedule[];
}

interface ScheduleTableProps {
  caption: string;
  groups: readonly ScheduleGroup[];
  accountNames: ReadonlyMap<string, string>;
  nextOn: ReadonlyMap<string, string>;
  scale: (code: string) => number;
  ended?: boolean;
  loading?: boolean;
}

// The schedules in groups of one table, so every column lines up across the kinds (spec B3, B4).
export function ScheduleTable({
  caption,
  groups,
  accountNames,
  nextOn,
  scale,
  ended = false,
  loading = false,
}: ScheduleTableProps) {
  const t = useT();

  // An ended table sits inside the frame of its collapsible, so it draws none of its own (spec P4).
  return (
    <Table
      columns={4}
      variant={ended ? "plain" : "framed"}
      edges={ended ? "flush" : "inset"}
    >
      <TableContent>
        {ended ? (
          <HiddenCaption text={caption} />
        ) : (
          <TableCaption>{caption}</TableCaption>
        )}
        <TableHead>
          <TableRow>
            <TableColumnHeader>{t("agenda.description")}</TableColumnHeader>
            <TableColumnHeader>{t("schedules.details")}</TableColumnHeader>
            <TableColumnHeader>{t("schedules.next")}</TableColumnHeader>
            <TableColumnHeader numeric>
              {t("schedules.amount")}
            </TableColumnHeader>
          </TableRow>
        </TableHead>
        {loading ? (
          <TableLoader skeletonRows={6} />
        ) : (
          <TableBody>
            {groups.map((group) => (
              <Fragment key={group.key}>
                {group.label !== undefined && (
                  <TableGroupRow end={group.end}>{group.label}</TableGroupRow>
                )}
                {group.schedules.map((s) => (
                  <ScheduleRow
                    key={s.id}
                    schedule={s}
                    accountNames={accountNames}
                    nextOn={nextOn.get(s.id)}
                    scale={scale}
                    ended={ended}
                  />
                ))}
              </Fragment>
            ))}
          </TableBody>
        )}
      </TableContent>
    </Table>
  );
}
