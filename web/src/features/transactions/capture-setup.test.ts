import { describe, expect, it } from "vitest";

import { captureSetup } from "@/features/transactions/capture-setup";

const scale = () => 2;

describe("captureSetup", () => {
  it("holds the accounts, the base currency and the scales once all loaded", () => {
    expect(captureSetup([], "BRL", scale)).toEqual({
      accounts: [],
      base: "BRL",
      scale,
    });
  });

  it("returns null without the accounts", () => {
    expect(captureSetup(undefined, "BRL", scale)).toBeNull();
  });

  it("returns null without the base currency", () => {
    expect(captureSetup([], undefined, scale)).toBeNull();
  });

  it("returns null without the scales", () => {
    expect(captureSetup([], "BRL", null)).toBeNull();
  });
});
