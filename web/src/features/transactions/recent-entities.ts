const prefix = "equori.recent.";
const maxRecent = 8;

// Recently picked ids, newest first. Storage may be blocked; the picker then lists no recent section.
export function loadRecent(kind: string): string[] {
  try {
    const raw = localStorage.getItem(prefix + kind);
    const parsed: unknown = raw === null ? [] : JSON.parse(raw);
    return Array.isArray(parsed)
      ? parsed.filter((id): id is string => typeof id === "string")
      : [];
  } catch {
    return [];
  }
}

export function saveRecent(kind: string, ids: string[]): string[] {
  const next = ids.slice(0, maxRecent);
  try {
    localStorage.setItem(prefix + kind, JSON.stringify(next));
  } catch {
    // The recent list is a convenience.
  }
  return next;
}
