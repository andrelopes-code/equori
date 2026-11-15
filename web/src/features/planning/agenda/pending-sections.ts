import type { AgendaGroup } from "@/features/planning/agenda/agenda-table";
import type { PendingGroups } from "@/features/planning/agenda/month-close";

// The pending groups as table groups, in their order, without the empty ones (spec A3).
export function pendingSections(
  groups: PendingGroups,
  labels: { overdue: string; week: string; later: string },
): AgendaGroup[] {
  const sections: AgendaGroup[] = [
    { key: "overdue", label: labels.overdue, rows: groups.overdue },
    { key: "week", label: labels.week, rows: groups.week },
    { key: "later", label: labels.later, rows: groups.later },
  ];

  return sections.filter((section) => section.rows.length > 0);
}
