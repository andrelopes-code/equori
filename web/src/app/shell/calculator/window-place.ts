export interface Place {
  x: number;
  y: number;
}

const STORAGE_KEY = "equori.calculator";

// K5: the last place of the window, kept per browser.
export function readPlace(): Place | null {
  try {
    const stored: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "");

    return isPlace(stored) ? { x: stored.x, y: stored.y } : null;
  } catch {
    return null;
  }
}

export function writePlace(place: Place): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(place));
  } catch {
    // The place still holds for this page load when storage is unavailable.
  }
}

function isPlace(value: unknown): value is Place {
  if (typeof value !== "object" || value === null) return false;

  const { x, y } = value as Record<string, unknown>;

  return Number.isFinite(x) && Number.isFinite(y);
}
