import { bookKey, bookKeyNames } from "@/features/session";

// Per-browser convenience: the groups a reader folded stay folded (spec 5.1).
export function readCollapsed(): Set<string> {
  const key = bookKey(bookKeyNames.planCollapsed);
  if (key === null) return new Set();
  try {
    const raw = localStorage.getItem(key);
    const parsed: unknown = raw === null ? [] : JSON.parse(raw);
    return new Set(
      Array.isArray(parsed)
        ? parsed.filter((v): v is string => typeof v === "string")
        : [],
    );
  } catch {
    return new Set();
  }
}

export function writeCollapsed(ids: ReadonlySet<string>) {
  const key = bookKey(bookKeyNames.planCollapsed);
  if (key === null) return;
  try {
    localStorage.setItem(key, JSON.stringify([...ids]));
  } catch {
    // A browser without storage keeps the groups open on the next visit.
  }
}
