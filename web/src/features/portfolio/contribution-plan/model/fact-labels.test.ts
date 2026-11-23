import { describe, expect, it } from "vitest";

import { piotroskiFacts } from "@/features/portfolio/contribution-plan/model/fact-answers";
import {
  factLabelKey,
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
