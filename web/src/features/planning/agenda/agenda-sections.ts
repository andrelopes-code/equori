import type { AgendaGroup } from "@/features/planning/agenda/agenda-table";
import type { PendingGroups } from "@/features/planning/agenda/month-close";

// The month's groups as table groups: the pending ones in their order, then what already
// happened; the empty ones are left out (spec A3).
export function agendaSections(
  groups: PendingGroups,
  labels: { overdue: string; week: string; later: string; done: string },
): AgendaGroup[] {
  const sections: AgendaGroup[] = [
    { key: "overdue", label: labels.overdue, rows: groups.overdue },
    { key: "week", label: labels.week, rows: groups.week },
    { key: "later", label: labels.later, rows: groups.later },
    { key: "done", label: labels.done, rows: groups.done },
  ];

  return sections.filter((section) => section.rows.length > 0);
}
