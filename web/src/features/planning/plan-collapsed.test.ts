import { beforeEach, describe, expect, it } from "vitest";

import {
  readCollapsed,
  writeCollapsed,
} from "@/features/planning/plan-collapsed";
import { rememberDeviceUser } from "@/features/session";

describe("collapsed plan groups", () => {
  beforeEach(() => {
    localStorage.clear();
    rememberDeviceUser({ id: 7, email: "owner@equori.test", booksId: 3 });
  });

  it("are stored under the key of the device's book", () => {
    writeCollapsed(new Set(["g1"]));
    expect(localStorage.getItem("equori.plan.collapsed.3")).toBe('["g1"]');
    expect(readCollapsed()).toEqual(new Set(["g1"]));
  });

  it("are empty in another book", () => {
    writeCollapsed(new Set(["g1"]));
    rememberDeviceUser({ id: 7, email: "owner@equori.test", booksId: 4 });
    expect(readCollapsed()).toEqual(new Set());
  });
});
