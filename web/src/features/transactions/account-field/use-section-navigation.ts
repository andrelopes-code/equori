import { useRef, useState } from "react";
import type { FocusEvent, KeyboardEvent } from "react";

import { nextPosition } from "@/features/transactions/account-field/section-navigation";
import type {
  GroupShape,
  NavigationKey,
  Position,
} from "@/features/transactions/account-field/section-navigation";

const navigationKeys = new Set<string>([
  "ArrowDown",
  "ArrowUp",
  "ArrowRight",
  "ArrowLeft",
  "Home",
  "End",
]);

export interface NavigationGroup {
  ids: readonly string[];
  columns: number;
}

// Roving focus over the options of the groups: one tab stop, on the focused option, else on the
// chosen one, else on the first.
export function useSectionNavigation(
  navigation: readonly NavigationGroup[],
  chosen: string | null,
) {
  const listRef = useRef<HTMLDivElement>(null);
  const [focused, setFocused] = useState<string | null>(null);

  const keys = navigation.map((group) => group.ids);
  const all = keys.flat();
  const present = (id: string | null) => id !== null && all.includes(id);
  const tabStop = present(focused)
    ? focused
    : present(chosen)
      ? chosen
      : all[0];
  const groups: GroupShape[] = navigation.map((group) => ({
    size: group.ids.length,
    columns: group.columns,
  }));

  function handleFocus(event: FocusEvent<HTMLDivElement>) {
    const id = optionId(event.target);
    if (id !== null) setFocused(id);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (!navigationKeys.has(event.key)) return;

    const id = optionId(event.target);
    const at = id === null ? null : positionOf(id, keys);
    if (at === null) return;

    event.preventDefault();
    const to = nextPosition(event.key as NavigationKey, at, groups);
    const target = to === null ? undefined : keys[to.group]?.[to.index];
    if (target !== undefined) focusOption(listRef.current, target);
  }

  return { listRef, tabStop, handleFocus, handleKeyDown };
}

function optionId(target: EventTarget): string | null {
  const option = (target as HTMLElement).closest<HTMLElement>(
    '[role="option"]',
  );
  return option?.dataset.key ?? null;
}

function positionOf(
  id: string,
  keys: readonly (readonly string[])[],
): Position | null {
  for (const [group, ids] of keys.entries()) {
    const index = ids.indexOf(id);
    if (index >= 0) return { group, index };
  }
  return null;
}

function focusOption(list: HTMLElement | null, id: string) {
  const options = list?.querySelectorAll<HTMLElement>('[role="option"]') ?? [];
  Array.from(options)
    .find((option) => option.dataset.key === id)
    ?.focus();
}
