// The overview's grid layout, kept with the member's appearance (analytics design 5.2, BK21).
export const overviewLayoutKey = "equori.overview.layout";

const listeners = new Set<() => void>();

// The store handed to usePersistedDashboardLayout: localStorage that tells the appearance sync
// of each write the grid makes.
export const overviewLayoutStorage = {
  getItem: (key: string) => localStorage.getItem(key),
  setItem: (key: string, value: string) => {
    localStorage.setItem(key, value);
    notify();
  },
  removeItem: (key: string) => {
    localStorage.removeItem(key);
    notify();
  },
};

export function subscribeOverviewLayout(listener: () => void): () => void {
  listeners.add(listener);

  return () => {
    listeners.delete(listener);
  };
}

// The stored layout, the snapshot the appearance sync renders on.
export function overviewLayoutSnapshot(): string | null {
  try {
    return localStorage.getItem(overviewLayoutKey);
  } catch {
    return null;
  }
}

// Called after the member's appearance rewrote storage.
export function restoredOverviewLayout(): void {
  notify();
}

function notify(): void {
  listeners.forEach((listener) => {
    listener();
  });
}
