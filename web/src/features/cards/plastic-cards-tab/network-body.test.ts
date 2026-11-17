import { describe, expect, it } from "vitest";

import {
  createNetwork,
  updateNetwork,
} from "@/features/cards/plastic-cards-tab/network-body";

describe("createNetwork", () => {
  it("carries a chosen network", () => {
    expect(createNetwork("visa")).toEqual({ network: "visa" });
  });

  it("leaves out no network", () => {
    expect(createNetwork("")).toEqual({});
  });
});

describe("updateNetwork", () => {
  const cases: [string, string | undefined, string, object][] = [
    ["a changed network", "visa", "elo", { network: "elo" }],
    ["a cleared network", "visa", "", { network: "" }],
    ["a first network", undefined, "visa", { network: "visa" }],
    ["an unchanged network", "visa", "visa", {}],
    ["no network kept", undefined, "", {}],
  ];

  it.each(cases)("%s", (_name, stored, chosen, expected) => {
    expect(updateNetwork(stored, chosen)).toEqual(expected);
  });
});
