import type { components } from "@/api/schema.gen";
import {
  type ShoppingEntry,
  memberEntry,
  groupEntry,
  positive,
  splitsAmongMembers,
} from "@/features/portfolio/contribution-plan/model/shopping-list";

type Plan = components["schemas"]["ContributionPlan"];
type Group = Plan["classes"][number];
type Member = Group["members"][number];

interface MemberRef {
  account_id?: string;
  instrument?: string;
}

export type RowFlag = "due" | "released" | "warned" | "wouldWait";

// Why a row receives nothing this month.
export type NoneReason = "noIdeal" | "atIdeal" | "small";

export interface ListRow {
  // The group and the asset: the same row after another read of the plan.
  key: string;
  group: number;
  // The position of the asset in its group; undefined for a row of the whole group.
  member?: number;
  name: string;
  groupName?: string;
  // The purchase; undefined without one.
  entry?: ShoppingEntry;
  // The criterion that holds the asset (CO6).
  heldBy?: number;
  reason?: NoneReason;
  flag?: RowFlag;
  // The held assets of a group that receives its amount undivided (CO11).
  without: string[];
}

export interface ListSections {
  buy: ListRow[];
  wait: ListRow[];
  none: ListRow[];
  // Whether the plan was split: without it the rows have no purchase.
  split: boolean;
}

// Every asset of the plan: what to buy, largest first, what waits and what receives nothing.
export function listSections(
  view: Plan,
  memberName: (ref: MemberRef) => string,
  scaleOf: (instrument: string) => number = () => 0,
): ListSections {
  const rows = view.classes.flatMap((cls, group) =>
    splitsAmongMembers(cls)
      ? cls.members.map((m, member) =>
          memberRow({ view, cls, group, m, member, memberName, scaleOf }),
        )
      : [groupRow(view, cls, group, memberName)],
  );
  const waits = (row: ListRow) => row.heldBy !== undefined;
  const split = view.classes.some((cls) => cls.amount !== undefined);
  const free = rows.filter((row) => !waits(row));

  return {
    split,
    buy: split
      ? free.filter((row) => row.entry !== undefined).sort(byCost)
      : free,
    wait: rows.filter(waits),
    none: split ? free.filter((row) => row.entry === undefined) : [],
  };
}

// How many answers of the plan are due (CO7).
export function dueCount(view: Plan): number {
  return view.classes
    .flatMap((cls) => cls.members)
    .reduce((sum, m) => sum + (m.due?.length ?? 0), 0);
}

export function rowsOf(sections: ListSections): ListRow[] {
  return [...sections.buy, ...sections.wait, ...sections.none];
}

interface MemberRowInput {
  view: Plan;
  cls: Group;
  group: number;
  m: Member;
  member: number;
  memberName: (ref: MemberRef) => string;
  scaleOf: (instrument: string) => number;
}

function memberRow({
  view,
  cls,
  group,
  m,
  member,
  memberName,
  scaleOf,
}: MemberRowInput): ListRow {
  const name = memberName(m);
  const held = m.held === true && !view.holds_ignored;
  const entry = memberEntry(m, group, memberName, scaleOf);
  const row: ListRow = {
    key: rowKey(cls, m),
    group,
    member,
    name,
    groupName: cls.name,
    without: [],
  };

  if (held) row.heldBy = m.held_by?.[0] ?? 0;
  else if (entry !== undefined) row.entry = entry;
  else if (cls.amount !== undefined) row.reason = noneReason(cls, m);

  return withFlag(row, memberFlag(view, m));
}

function groupRow(
  view: Plan,
  cls: Group,
  group: number,
  memberName: (ref: MemberRef) => string,
): ListRow {
  const held = cls.held && !view.holds_ignored;
  const entry = groupEntry(cls, group);
  const row: ListRow = {
    key: rowKey(cls),
    group,
    name: cls.name,
    without:
      held || view.holds_ignored
        ? []
        : cls.members.filter((m) => m.held === true).map(memberName),
  };

  if (held) {
    row.heldBy = cls.members.find((m) => m.held === true)?.held_by?.[0] ?? 0;
  } else if (entry !== undefined) row.entry = entry;
  else if (cls.amount !== undefined) {
    row.reason = cls.target_bp === 0 ? "noIdeal" : "atIdeal";
  }

  return withFlag(row, groupFlag(view, cls));
}

function rowKey(cls: Group, m?: Member): string {
  return `${cls.name}/${m?.instrument ?? m?.account_id ?? ""}`;
}

function noneReason(cls: Group, m: Member): NoneReason {
  if (cls.target_bp === 0 || m.target_bp === 0) return "noIdeal";

  return positive(m.amount) ? "small" : "atIdeal";
}

function memberFlag(view: Plan, m: Member): RowFlag | undefined {
  if ((m.due?.length ?? 0) > 0) return "due";
  if (m.held === true && view.holds_ignored) return "wouldWait";
  if (m.released === true && (m.held_by?.length ?? 0) > 0) return "released";

  return (m.warned_by?.length ?? 0) > 0 ? "warned" : undefined;
}

// The first flag among the members, in the order of memberFlag.
function groupFlag(view: Plan, cls: Group): RowFlag | undefined {
  const flags = cls.members.map((m) => memberFlag(view, m));

  return (["due", "wouldWait", "released", "warned"] as const).find((flag) =>
    flags.includes(flag),
  );
}

function withFlag(row: ListRow, flag: RowFlag | undefined): ListRow {
  return flag === undefined ? row : { ...row, flag };
}

function byCost(a: ListRow, b: ListRow): number {
  return (
    (b.entry?.cost.amount ?? 0) - (a.entry?.cost.amount ?? 0) ||
    a.name.localeCompare(b.name)
  );
}
