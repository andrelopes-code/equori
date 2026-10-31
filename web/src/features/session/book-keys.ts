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
