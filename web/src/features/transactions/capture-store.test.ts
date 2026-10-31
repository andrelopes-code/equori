import { beforeEach, describe, expect, it } from "vitest";

import { rememberDeviceUser } from "@/features/session";
import {
  readDefaultAccount,
  writeDefaultAccount,
} from "@/features/transactions/capture-store";

describe("default account", () => {
  beforeEach(() => {
    localStorage.clear();
    rememberDeviceUser({ id: 7, email: "owner@equori.test", booksId: 3 });
  });

  it("is stored under the key of the device's book", () => {
    writeDefaultAccount("a1");
    expect(localStorage.getItem("equori.capture.defaultAccount.3")).toBe("a1");
    expect(readDefaultAccount()).toBe("a1");
  });

  it("is null in another book", () => {
    writeDefaultAccount("a1");
    rememberDeviceUser({ id: 7, email: "owner@equori.test", booksId: 4 });
    expect(readDefaultAccount()).toBeNull();
  });

  it("is removed by writing null", () => {
    writeDefaultAccount("a1");
    writeDefaultAccount(null);
    expect(localStorage.getItem("equori.capture.defaultAccount.3")).toBeNull();
  });
});
