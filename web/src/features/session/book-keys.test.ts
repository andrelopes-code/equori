import { beforeEach, describe, expect, it } from "vitest";

import { bookKey, bookKeyNames } from "@/features/session/book-keys";
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
