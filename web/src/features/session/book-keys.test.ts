import { beforeEach, describe, expect, it } from "vitest";

import type { BooksMembership } from "@/features/session/api";
import {
  bookKey,
  bookKeyNames,
  hasUnsuffixedBookKeys,
  moveUnsuffixedBookKeys,
} from "@/features/session/book-keys";
import { rememberDeviceUser } from "@/features/session/device-user";

describe("bookKey", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("is null without a device user", () => {
    expect(bookKey(bookKeyNames.captureQueue)).toBeNull();
  });

  it.each([
    [bookKeyNames.captureQueue, "equori.capture.queue.3"],
    [bookKeyNames.planCollapsed, "equori.plan.collapsed.3"],
  ])("suffixes %s with the books ID of the device user", (name, want) => {
    rememberDeviceUser({ id: 7, email: "owner@equori.test", booksId: 3 });
    expect(bookKey(name)).toBe(want);
  });
});

describe("hasUnsuffixedBookKeys", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("is false with empty storage", () => {
    expect(hasUnsuffixedBookKeys()).toBe(false);
  });

  it("is true when an unsuffixed key is stored", () => {
    localStorage.setItem(bookKeyNames.planCollapsed, "[]");

    expect(hasUnsuffixedBookKeys()).toBe(true);
  });

  it("is false when only the suffixed key is stored", () => {
    localStorage.setItem(`${bookKeyNames.planCollapsed}.5`, "[]");

    expect(hasUnsuffixedBookKeys()).toBe(false);
  });
});

describe("moveUnsuffixedBookKeys", () => {
  const books: BooksMembership[] = [
    { id: 2, name: "A", role: "write", active: false },
    { id: 5, name: "B", role: "owner", active: true },
    { id: 9, name: "C", role: "owner", active: false },
  ];

  beforeEach(() => {
    localStorage.clear();
  });

  it("moves an unsuffixed value under the lowest owner book", () => {
    localStorage.setItem(bookKeyNames.recentCategories, '["c1"]');

    moveUnsuffixedBookKeys(books);

    expect(localStorage.getItem(`${bookKeyNames.recentCategories}.5`)).toBe(
      '["c1"]',
    );
    expect(localStorage.getItem(bookKeyNames.recentCategories)).toBeNull();
  });

  it("keeps a suffixed value that already exists", () => {
    localStorage.setItem(bookKeyNames.recentCategories, '["c1"]');
    localStorage.setItem(`${bookKeyNames.recentCategories}.5`, '["c2"]');

    moveUnsuffixedBookKeys(books);

    expect(localStorage.getItem(`${bookKeyNames.recentCategories}.5`)).toBe(
      '["c2"]',
    );
    expect(localStorage.getItem(bookKeyNames.recentCategories)).toBeNull();
  });

  it("deletes the unsuffixed value without an owner book", () => {
    localStorage.setItem(bookKeyNames.recentCategories, '["c1"]');

    moveUnsuffixedBookKeys([{ id: 2, name: "A", role: "read", active: true }]);

    const stored = Object.keys(localStorage).filter((key) =>
      key.startsWith(bookKeyNames.recentCategories),
    );
    expect(stored).toEqual([]);
  });

  it("moves the four keys", () => {
    localStorage.setItem(bookKeyNames.defaultAccount, '"a1"');
    localStorage.setItem(bookKeyNames.captureQueue, "[]");
    localStorage.setItem(bookKeyNames.recentCategories, '["c1"]');
    localStorage.setItem(bookKeyNames.planCollapsed, '["g1"]');

    moveUnsuffixedBookKeys(books);

    expect(Object.fromEntries(Object.entries(localStorage))).toEqual({
      [`${bookKeyNames.defaultAccount}.5`]: '"a1"',
      [`${bookKeyNames.captureQueue}.5`]: "[]",
      [`${bookKeyNames.recentCategories}.5`]: '["c1"]',
      [`${bookKeyNames.planCollapsed}.5`]: '["g1"]',
    });
  });
});
