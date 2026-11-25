import { useState } from "react";

import type { components } from "@/api/schema.gen";
import {
  type ListRow,
  type ListSections,
  rowsOf,
} from "@/features/portfolio/contribution-plan/list/list-rows";

type Plan = components["schemas"]["ContributionPlan"];

interface OpenRow {
  key: string | undefined;
  // Whether the reader chose the row: the panel that opens by itself takes no focus.
  asked: boolean;
}

// The row whose panel is open. At the first read it is the first asset that waits, else the first with
// a due answer; after that only the reader opens and closes it.
export function useOpenRow(sections: ListSections, plan: Plan) {
  const [open, setOpen] = useState<OpenRow>(() => ({
    key: firstRow(sections)?.key,
    asked: false,
  }));

  const rows = rowsOf(sections);
  const row = rows.find((r) => r.key === open.key);

  function handleOpen(next: ListRow) {
    setOpen(
      next.key === open.key
        ? { key: undefined, asked: true }
        : { key: next.key, asked: true },
    );
  }

  const dueRows = rows.filter((r) => hasDue(plan, r));

  return {
    row,
    // Whether an asset other than the one open has a due answer.
    moreDue: dueRows.some((r) => r.key !== row?.key),
    asked: open.asked,
    onOpen: handleOpen,
    onClose: () => {
      const closed = open.key;
      setOpen({ key: undefined, asked: true });
      if (closed !== undefined)
        document.getElementById(`plan-row-${closed}`)?.focus();
    },
    // The next row with a due answer, after the one open.
    onNextDue: () => {
      const at = dueRows.findIndex((r) => r.key === open.key);
      const next = dueRows[(at + 1) % Math.max(dueRows.length, 1)];
      if (next !== undefined) setOpen({ key: next.key, asked: true });
    },
  };
}

function firstRow(sections: ListSections): ListRow | undefined {
  return sections.wait[0] ?? rowsOf(sections).find((row) => row.flag === "due");
}

function hasDue(plan: Plan, row: ListRow): boolean {
  const members = plan.classes[row.group]?.members ?? [];
  const own =
    row.member === undefined ? members : members.slice(row.member).slice(0, 1);

  return own.some((m) => (m.due?.length ?? 0) > 0);
}
