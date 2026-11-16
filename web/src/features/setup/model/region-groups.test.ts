import { describe, expect, it } from "vitest";

import { groupByRegion } from "@/features/setup/model/region-groups";

const regionOf = (item: string) => item.slice(0, item.indexOf(":"));
const items = ["US:a", "global:b", "BR:c", "EU:d", "BR:e", "US:f"];

describe("groupByRegion", () => {
  it("puts the home region first, the global region second and the rest by code", () => {
    const groups = groupByRegion(items, regionOf, "BR");

    expect(groups.home).toEqual({ region: "BR", items: ["BR:c", "BR:e"] });
    expect(groups.global).toEqual({ region: "global", items: ["global:b"] });
    expect(groups.others).toEqual([
      { region: "EU", items: ["EU:d"] },
      { region: "US", items: ["US:a", "US:f"] },
    ]);
  });

  it("has no home group when the home region holds no item", () => {
    const groups = groupByRegion(items, regionOf, "DE");

    expect(groups.home).toBeNull();
    expect(groups.others.map((g) => g.region)).toEqual(["BR", "EU", "US"]);
  });

  it("has no home group when the home region is unknown", () => {
    expect(groupByRegion(items, regionOf, undefined).home).toBeNull();
  });

  it("has no global group when no item is global", () => {
    expect(groupByRegion(["BR:c"], regionOf, "BR").global).toBeNull();
  });

  it("never lists the global region among the others, whatever the home", () => {
    const groups = groupByRegion(items, regionOf, "global");

    expect(groups.home).toBeNull();
    expect(groups.global?.items).toEqual(["global:b"]);
  });

  it("keeps the order of the items inside a group", () => {
    expect(groupByRegion(["US:z", "US:a"], regionOf, "BR").others).toEqual([
      { region: "US", items: ["US:z", "US:a"] },
    ]);
  });
});
