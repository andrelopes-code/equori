import { beforeEach, describe, expect, it } from "vitest";

import {
  forgetDeviceUser,
  readDeviceUser,
  rememberDeviceUser,
} from "@/features/session/device-user";

describe("device user", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("returns null before any sign-in", () => {
    expect(readDeviceUser()).toBeNull();
  });

  it("keeps id and email until forgotten", () => {
    rememberDeviceUser({ id: 7, email: "owner@equori.test" });
    expect(readDeviceUser()).toEqual({ id: 7, email: "owner@equori.test" });
    forgetDeviceUser();
    expect(readDeviceUser()).toBeNull();
  });

  it("ignores a stored value of another shape", () => {
    localStorage.setItem("equori.device.user", '{"id":"7"}');
    expect(readDeviceUser()).toBeNull();
  });
});
