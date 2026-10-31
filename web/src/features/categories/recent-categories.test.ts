import { beforeEach, describe, expect, it } from "vitest";

import {
  readRecentCategories,
  rememberCategory,
} from "@/features/categories/recent-categories";
import { forgetDeviceUser, rememberDeviceUser } from "@/features/session";

beforeEach(() => {
  localStorage.clear();
  rememberDeviceUser({ id: 7, email: "owner@equori.test", booksId: 3 });
});

describe("recent categories", () => {
  it("is empty when nothing is stored or the value is not a list", () => {
    expect(readRecentCategories()).toEqual([]);
    localStorage.setItem("equori.recent-categories.3", "{");
    expect(readRecentCategories()).toEqual([]);
    localStorage.setItem("equori.recent-categories.3", '{"a":1}');
    expect(readRecentCategories()).toEqual([]);
  });

  it("keeps the latest choice first, once, and at most five", () => {
    for (const id of ["a", "b", "c", "d", "e", "f", "c"]) rememberCategory(id);
    expect(readRecentCategories()).toEqual(["c", "f", "e", "d", "b"]);
  });

  it("stores the list under the key of the device's book", () => {
    rememberCategory("c1");
    expect(localStorage.getItem("equori.recent-categories.3")).toBe('["c1"]');
    expect(localStorage.getItem("equori.recent-categories")).toBeNull();
  });

  it("reads the list of another book as empty", () => {
    rememberCategory("c1");
    rememberDeviceUser({ id: 7, email: "owner@equori.test", booksId: 4 });
    expect(readRecentCategories()).toEqual([]);
  });

  it("stores nothing without a device user", () => {
    forgetDeviceUser();
    rememberCategory("c1");
    expect(localStorage.length).toBe(0);
  });
});
