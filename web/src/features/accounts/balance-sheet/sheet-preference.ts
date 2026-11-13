import type {
  GroupBy,
  Order,
} from "@/features/accounts/balance-sheet/sheet-layout";

export interface SheetPreference {
  group: GroupBy;
  order: Order;
}

const storageKey = "equori.accounts.sheet";
const defaults: SheetPreference = { group: "kind", order: "balance" };

// Per-browser convenience (AL16): how the reader last grouped and ordered the list. It holds no
// identifier, so the key carries no book. A value the code does not know is read as the default.
export function readSheetPreference(): SheetPreference {
  try {
    const raw = localStorage.getItem(storageKey);
    const parsed: unknown = raw === null ? undefined : JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null) return defaults;
    const { group, order } = parsed as Record<string, unknown>;
    return {
      group:
        group === "kind" || group === "institution" || group === "none"
          ? group
          : defaults.group,
      order:
        order === "balance" || order === "name" || order === "attention"
          ? order
          : defaults.order,
    };
  } catch {
    return defaults;
  }
}

export function writeSheetPreference(preference: SheetPreference) {
  try {
    localStorage.setItem(storageKey, JSON.stringify(preference));
  } catch {
    // A browser that refuses storage keeps the choice for this visit.
  }
}
