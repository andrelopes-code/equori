import type { components } from "@/api/schema.gen";

type Account = components["schemas"]["Account"];

export type CategoryClass = "expense" | "income";
export type CategoryIconName = components["schemas"]["CategoryIcon"];

export interface CategoryEntry {
  id: string;
  name: string;
  // Names from the root down to the category, joined by the separator.
  path: string;
  depth: number;
  parentId?: string;
  class: CategoryClass;
  color?: number;
  icon?: CategoryIconName;
  archived: boolean;
  // The system account that holds what no category decided yet.
  uncategorized: boolean;
  systemRole?: string;
}

export const pathSeparator = " › ";

export function isUncategorizedRole(role: string | undefined): boolean {
  return role?.startsWith("uncategorized") === true;
}

function isCategory(
  account: Account,
): account is Account & { class: CategoryClass } {
  return account.class === "expense" || account.class === "income";
}

// Every category of the accounts, expense before income, each class ordered by path.
export function categoryEntries(
  accounts: readonly Account[],
  locale: string,
): CategoryEntry[] {
  const byId = new Map(accounts.map((a) => [a.id, a]));
  const entries = accounts.filter(isCategory).map((account) => {
    const names = [account.name];
    const seen = new Set([account.id]);
    let parent =
      account.parent_id === undefined ? undefined : byId.get(account.parent_id);
    // A parent seen before is a cycle the server should never hold; the walk stops there.
    while (parent !== undefined && !seen.has(parent.id)) {
      seen.add(parent.id);
      names.unshift(parent.name);
      parent =
        parent.parent_id === undefined ? undefined : byId.get(parent.parent_id);
    }
    const entry: CategoryEntry = {
      id: account.id,
      name: account.name,
      path: names.join(pathSeparator),
      depth: names.length - 1,
      class: account.class,
      archived: account.closed_on !== undefined,
      uncategorized: isUncategorizedRole(account.system_role),
      ...(account.parent_id === undefined
        ? {}
        : { parentId: account.parent_id }),
      ...(account.color === undefined ? {} : { color: account.color }),
      ...(account.icon === undefined ? {} : { icon: account.icon }),
      ...(account.system_role === undefined
        ? {}
        : { systemRole: account.system_role }),
    };
    return entry;
  });
  const collator = new Intl.Collator(locale, { sensitivity: "base" });
  const classOrder: Record<CategoryClass, number> = { expense: 0, income: 1 };
  return entries.sort(
    (a, b) =>
      classOrder[a.class] - classOrder[b.class] ||
      collator.compare(a.path, b.path),
  );
}

// The categories a person may choose: open, not the uncategorized holders, the class the
// amount's sign suggests first.
export function orderForAmount(
  entries: readonly CategoryEntry[],
  amount: number,
): CategoryEntry[] {
  const first: CategoryClass = amount > 0 ? "income" : "expense";
  const open = entries.filter((e) => !e.archived && !e.uncategorized);
  return [
    ...open.filter((e) => e.class === first),
    ...open.filter((e) => e.class !== first),
  ];
}
