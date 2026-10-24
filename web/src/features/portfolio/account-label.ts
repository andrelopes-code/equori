import type { components } from "@/api/schema.gen";

type Account = components["schemas"]["Account"];

// "Parent / name" for a sub-account; the raw id while the accounts load.
export function accountLabel(byID: ReadonlyMap<string, Account>, id: string) {
  const a = byID.get(id);
  if (a === undefined) return id;
  const parent = a.parent_id === undefined ? undefined : byID.get(a.parent_id);
  return parent === undefined ? a.name : `${parent.name} / ${a.name}`;
}
