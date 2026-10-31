import { beforeEach, describe, expect, it } from "vitest";

import {
  forgetInviteToken,
  readInviteToken,
  writeInviteToken,
} from "@/features/session/invite-token";

beforeEach(() => {
  sessionStorage.clear();
});

describe("invite token", () => {
  it("reads back the token written", () => {
    writeInviteToken("tok_abc");

    expect(readInviteToken()).toBe("tok_abc");
  });

  it("reads null once forgotten", () => {
    writeInviteToken("tok_abc");
    forgetInviteToken();

    expect(readInviteToken()).toBeNull();
  });
});
