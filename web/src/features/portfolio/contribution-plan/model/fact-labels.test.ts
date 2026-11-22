import { describe, expect, it } from "vitest";

import { piotroskiFacts } from "@/features/portfolio/contribution-plan/model/fact-answers";
import {
  factLabelKey,
  factsPrefix,
  factText,
} from "@/features/portfolio/contribution-plan/model/fact-labels";

describe("factLabelKey", () => {
  it("maps each fact of the catalog to its own key", () => {
    expect(piotroskiFacts.map(factLabelKey)).toEqual([
      "contributionPlan.facts.piotroski_p1",
      "contributionPlan.facts.piotroski_p2",
      "contributionPlan.facts.piotroski_p3",
      "contributionPlan.facts.piotroski_p4",
      "contributionPlan.facts.piotroski_p5",
      "contributionPlan.facts.piotroski_p6",
      "contributionPlan.facts.piotroski_p7",
      "contributionPlan.facts.piotroski_p8",
      "contributionPlan.facts.piotroski_p9",
    ]);
  });

  it("returns undefined for an unknown fact and for no fact", () => {
    expect(factLabelKey("piotroski_p10")).toBeUndefined();
    expect(factLabelKey("")).toBeUndefined();
  });
});

describe("factText", () => {
  const t = (key: string) => `catalog:${key}`;

  it("returns the catalog text of a known fact", () => {
    expect(factText(t, "piotroski_p2", "stored")).toBe(
      "catalog:contributionPlan.facts.piotroski_p2",
    );
  });

  it("returns the stored text for an unknown fact and for no fact", () => {
    expect(factText(t, "piotroski_p10", "stored")).toBe("stored");
    expect(factText(t, "", "stored")).toBe("stored");
  });
});

describe("factsPrefix", () => {
  const t = (key: string, vars?: Record<string, string | number>) =>
    `${key}:${String(vars?.year ?? "")}`;

  it("writes the fiscal year through Intl", () => {
    expect(factsPrefix(t, "en", "2025-12-31", ["piotroski_p1"])).toBe(
      "contributionPlan.facts.year:2025",
    );
  });

  it("states the absence of filings when a fact is named and no year exists", () => {
    expect(factsPrefix(t, "en", undefined, ["", "piotroski_p1"])).toBe(
      "contributionPlan.facts.none:",
    );
  });

  it("is empty when no fact is named and no year exists", () => {
    expect(factsPrefix(t, "en", undefined, ["", ""])).toBe("");
  });
});
