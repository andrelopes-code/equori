import { bookKey, bookKeyNames } from "@/features/session";

const maxRecent = 5;

// Storage may be absent or refuse access (private window, blocked site data); the list is then empty.
export function readRecentCategories(): string[] {
  const key = bookKey(bookKeyNames.recentCategories);
  if (key === null) return [];
  try {
    const raw = localStorage.getItem(key);
    if (raw === null) return [];
    const value: unknown = JSON.parse(raw);
    return Array.isArray(value)
      ? value
          .filter((v): v is string => typeof v === "string")
          .slice(0, maxRecent)
      : [];
  } catch {
    return [];
  }
}

export function rememberCategory(id: string): void {
  const next = [id, ...readRecentCategories().filter((v) => v !== id)].slice(
    0,
    maxRecent,
  );
  const key = bookKey(bookKeyNames.recentCategories);
  if (key === null) return;
  try {
    localStorage.setItem(key, JSON.stringify(next));
  } catch {
    // The choice still applies; only the shortcut to it is lost.
  }
}
