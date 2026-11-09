import { useSyncExternalStore } from "react";

import { isAccent, readAccent, repaintAccent } from "@/theme/accent";
import type { Accent } from "@/theme/accent";

const ACCENTS_KEY = "equori.bookAccents";
const ACTIVE_KEY = "equori.activeBooks";

const listeners = new Set<() => void>();
let suspended = false;
// useSyncExternalStore needs one object per stored string.
let cached: { raw: string | null; map: Record<string, Accent> } = {
  raw: null,
  map: {},
};

// The accent of each book, by book ID; a malformed map or value reads as absent.
export function readBookAccents(): Record<string, Accent> {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(ACCENTS_KEY);
  } catch {
    // Storage is unavailable: no book has its own accent.
  }
  if (raw === cached.raw) return cached.map;
  cached = { raw, map: parseBookAccents(raw) };
  return cached.map;
}

// Drops the books the member no longer belongs to, then repaints.
export function writeBookAccents(
  next: Record<string, Accent>,
  memberships: readonly number[],
): void {
  const kept: Record<string, Accent> = {};
  for (const [id, accent] of Object.entries(next)) {
    if (memberships.includes(Number(id))) kept[id] = accent;
  }
  try {
    localStorage.setItem(ACCENTS_KEY, JSON.stringify(kept));
  } catch {
    // Storage is unavailable: the choice is not kept.
  }
  changed();
}

export function readActiveBooks(): number | undefined {
  try {
    const id = Number(localStorage.getItem(ACTIVE_KEY));
    return Number.isInteger(id) && id > 0 ? id : undefined;
  } catch {
    return undefined;
  }
}

export function writeActiveBooks(id: number): void {
  const before = readActiveBooks();
  try {
    localStorage.setItem(ACTIVE_KEY, String(id));
  } catch {
    // Storage is unavailable: the next page load paints the theme's accent.
  }
  if (before !== id) changed();
}

// The studio edits the theme's accent, so it shows that accent and not the book's.
export function suspendBookAccent(on: boolean): void {
  suspended = on;
  changed();
}

// The active book's own accent; the theme's accent while suspended or when the book has none.
export function effectiveAccent(): Accent {
  if (suspended) return readAccent();
  const id = readActiveBooks();
  return (
    (id === undefined ? undefined : readBookAccents()[String(id)]) ??
    readAccent()
  );
}

export function useBookAccents(): Record<string, Accent> {
  return useSyncExternalStore(subscribe, readBookAccents);
}

function parseBookAccents(raw: string | null): Record<string, Accent> {
  if (raw === null) return {};
  try {
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null) return {};
    const map: Record<string, Accent> = {};
    for (const [id, accent] of Object.entries(parsed)) {
      if (isAccent(accent)) map[id] = accent;
    }
    return map;
  } catch {
    return {};
  }
}

function changed(): void {
  repaintAccent();
  listeners.forEach((listener) => {
    listener();
  });
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
