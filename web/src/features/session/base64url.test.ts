import { describe, expect, it } from "vitest";

import { decodeBase64url, encodeBase64url } from "@/features/session/base64url";

describe("base64url", () => {
  it.each([
    [[], ""],
    [[1, 2], "AQI"],
    [[255, 254, 253], "__79"],
    [[251, 255], "-_8"],
  ])("converts %j and %j", (bytes, text) => {
    expect(encodeBase64url(new Uint8Array(bytes).buffer)).toBe(text);
    expect([...decodeBase64url(text)]).toEqual(bytes);
  });
});
