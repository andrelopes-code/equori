import type { components } from "@/api/schema.gen";
import { readDeviceUser } from "@/features/session/device-user";

// HA29: browser keys whose values hold IDs of one book; each is stored as <name>.<booksId>.
export const bookKeyNames = {
  defaultAccount: "equori.capture.defaultAccount",
  captureQueue: "equori.capture.queue",
  recentCategories: "equori.recent-categories",
  planCollapsed: "equori.plan.collapsed",
} as const;

export type BookKeyName = (typeof bookKeyNames)[keyof typeof bookKeyNames];

// The book is the one of the last online session (HA30); without a device user no key exists.
export function bookKey(name: BookKeyName): string | null {
  const user = readDeviceUser();
  return user === null ? null : `${name}.${String(user.booksId)}`;
}

export function hasUnsuffixedBookKeys(): boolean {
  try {
    return Object.values(bookKeyNames).some(
      (name) => localStorage.getItem(name) !== null,
    );
  } catch {
    return false;
  }
}

// HA31: an unsuffixed value moves to the lowest owner book; a suffixed value already there wins.
export function moveUnsuffixedBookKeys(
  books: readonly components["schemas"]["BooksMembership"][],
): void {
  const owners = books.filter((book) => book.role === "owner");
  const target = owners.reduce<number | null>(
    (lowest, book) => (lowest === null || book.id < lowest ? book.id : lowest),
    null,
  );

  try {
    for (const name of Object.values(bookKeyNames)) {
      const value = localStorage.getItem(name);
      if (value === null) continue;

      // The write comes first: a refused write keeps the value for the next load.
      const key = `${name}.${String(target)}`;
      if (target !== null && localStorage.getItem(key) === null) {
        localStorage.setItem(key, value);
      }

      localStorage.removeItem(name);
    }
  } catch {
    // A refused storage leaves the keys as they are.
  }
}
