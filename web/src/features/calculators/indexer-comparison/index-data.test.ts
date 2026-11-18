import { describe, expect, it } from "vitest";

import { indexDataOf } from "@/features/calculators/indexer-comparison/index-data";

const cdi = { id: "cdi", period: "day" as const };
const rates = [{ date: "2026-10-16", rate: 0.0004 }];
const survey = {
  surveyDate: "2026-11-13",
  points: [{ date: "2026-12-31", rate: 0.1 }],
};

describe("indexDataOf", () => {
  it("joins the rates and the survey of an index", () => {
    const got = indexDataOf(
      [cdi],
      [{ data: rates, isPending: false }],
      [{ data: survey, isPending: false }],
    );

    expect(got.get("cdi")).toEqual({
      id: "cdi",
      period: "day",
      rates,
      points: survey.points,
      surveyDate: "2026-11-13",
      dailySpread: false,
    });
  });

  it("leaves an index out while its rates or its survey load", () => {
    expect(
      indexDataOf(
        [cdi],
        [{ data: undefined, isPending: true }],
        [{ data: survey, isPending: false }],
      ).size,
    ).toBe(0);
    expect(
      indexDataOf(
        [cdi],
        [{ data: rates, isPending: false }],
        [{ data: undefined, isPending: true }],
      ).size,
    ).toBe(0);
  });

  it("keeps an index whose survey failed, without points", () => {
    const got = indexDataOf(
      [cdi],
      [{ data: rates, isPending: false }],
      [{ data: undefined, isPending: false }],
    );

    expect(got.get("cdi")).toMatchObject({ points: [], surveyDate: "" });
  });
});
