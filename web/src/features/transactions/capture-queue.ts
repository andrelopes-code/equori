// P4 of ADR 022: texts written without the server, kept until recorded or discarded.
const key = "equori.capture.queue";

export interface QueuedCapture {
  id: string;
  userId: number;
  text: string;
  defaultAccountId: string | null;
  // YYYY-MM-DD, the device's local date.
  capturedOn: string;
  // ISO 8601 instant.
  createdAt: string;
}

export class QueueWriteError extends Error {}

function isQueued(v: unknown): v is QueuedCapture {
  if (typeof v !== "object" || v === null) return false;
  const e = v as Record<string, unknown>;
  return (
    typeof e.id === "string" &&
    typeof e.userId === "number" &&
    typeof e.text === "string" &&
    (e.defaultAccountId === null || typeof e.defaultAccountId === "string") &&
    typeof e.capturedOn === "string" &&
    typeof e.createdAt === "string"
  );
}

function readAll(): QueuedCapture[] {
  try {
    const raw = localStorage.getItem(key);
    if (raw === null) return [];
    const v: unknown = JSON.parse(raw);
    return Array.isArray(v) ? v.filter(isQueued) : [];
  } catch {
    return [];
  }
}

export function readQueue(userId: number): QueuedCapture[] {
  return readAll()
    .filter((e) => e.userId === userId)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

export function findQueued(id: string): QueuedCapture | undefined {
  return readAll().find((e) => e.id === id);
}

// P7: a refused write throws, so the screen keeps the text in its field.
export function enqueueCapture(
  entry: Omit<QueuedCapture, "id" | "createdAt">,
  now?: Date,
): QueuedCapture {
  const all = readAll();
  const queued: QueuedCapture = {
    ...entry,
    id: crypto.randomUUID(),
    createdAt: (now ?? new Date()).toISOString(),
  };
  try {
    localStorage.setItem(key, JSON.stringify([...all, queued]));
  } catch {
    throw new QueueWriteError("the device refused to store the capture");
  }
  // P8: the first entry asks the browser not to evict the site's storage; jsdom and older
  // browsers have no StorageManager.
  const storage = navigator.storage as StorageManager | undefined;
  if (all.length === 0) void storage?.persist();
  return queued;
}

export function removeQueued(id: string): void {
  try {
    localStorage.setItem(
      key,
      JSON.stringify(readAll().filter((e) => e.id !== id)),
    );
  } catch {
    // A failed removal leaves the entry in the queue; it never loses one.
  }
}
