import type { GridColumnState } from "@slotted/core/grid";
import { useState } from "react";

// PC7: the columns a reader adds stay for the next visit, on this device only.
export function useColumnState(
  key: string,
  initial: Partial<GridColumnState>,
): [GridColumnState, (next: GridColumnState) => void] {
  const [state, setState] = useState<GridColumnState>(() =>
    complete(read(key) ?? initial),
  );

  function change(next: GridColumnState) {
    setState(next);
    write(key, next);
  }

  return [state, change];
}

function complete(state: Partial<GridColumnState>): GridColumnState {
  return {
    order: state.order ?? [],
    widths: state.widths ?? {},
    hidden: state.hidden ?? [],
    pinned: state.pinned ?? { start: [], end: [] },
  };
}

function read(key: string): Partial<GridColumnState> | undefined {
  try {
    const raw = localStorage.getItem(key);

    return raw === null
      ? undefined
      : (JSON.parse(raw) as Partial<GridColumnState>);
  } catch {
    return undefined;
  }
}

function write(key: string, state: Partial<GridColumnState>) {
  try {
    localStorage.setItem(key, JSON.stringify(state));
  } catch {
    // A browser that refuses storage keeps the choice for this visit.
  }
}
