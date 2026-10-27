import { useState } from "react";

export type BlockID =
  | "net-worth"
  | "month-flows"
  | "spending"
  | "upcoming"
  | "cards"
  | "budgets"
  | "goals"
  | "indicators";

export const blockIDs: readonly BlockID[] = [
  "net-worth",
  "month-flows",
  "spending",
  "upcoming",
  "cards",
  "budgets",
  "goals",
  "indicators",
];

// Per browser, as the privacy choice is kept (analytics design 5.2).
export const hiddenKey = "equori.overview.hidden";

function isBlockID(value: unknown): value is BlockID {
  return blockIDs.includes(value as BlockID);
}

// A value that cannot be read hides nothing; an id this build does not know is dropped.
export function readHidden(raw: string | null): ReadonlySet<BlockID> {
  if (raw === null) return new Set();
  try {
    const value: unknown = JSON.parse(raw);
    return new Set(Array.isArray(value) ? value.filter(isBlockID) : []);
  } catch {
    return new Set();
  }
}

function load(): ReadonlySet<BlockID> {
  try {
    return readHidden(localStorage.getItem(hiddenKey));
  } catch {
    return new Set();
  }
}

// A browser that refuses storage keeps the choice for the visit only.
function store(next: ReadonlySet<BlockID>): void {
  try {
    if (next.size === 0) localStorage.removeItem(hiddenKey);
    else localStorage.setItem(hiddenKey, JSON.stringify([...next]));
  } catch {
    // The choice stays in memory.
  }
}

export function useHiddenBlocks() {
  const [hidden, setHidden] = useState(load);
  return {
    hidden,
    hide: (id: BlockID) => {
      const next = new Set(hidden).add(id);
      store(next);
      setHidden(next);
    },
    showAll: () => {
      const next = new Set<BlockID>();
      store(next);
      setHidden(next);
    },
  };
}
