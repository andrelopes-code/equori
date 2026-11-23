import { describe, expect, it } from "vitest";

import { catalogEn } from "@/i18n/catalog.en";
import type { TFunction } from "@/i18n/i18n-provider";

import {
  initialDraft,
  termsBody,
  type TermsDraft,
} from "@/features/instruments/terms/terms-draft";

const t: TFunction = (key) => catalogEn[key];

const draft: TermsDraft = {
  issued: "2026-10-17",
  matures: "2027-10-17",
  index: "ipca",
  percent: "100",
  spread: "6",
  dayCount: "act365",
  face: 100000,
  calendar: "",
  dailyLiquidity: false,
  redeemableFrom: "",
  payments: { every: 0, first: "", amortizations: [] },
  rateSteps: {},
};

describe("termsBody", () => {
  it("builds the body of an index with a spread (S124)", () => {
    expect(termsBody(draft, t)).toEqual({
      body: {
        issued_on: "2026-10-17",
        matures_on: "2027-10-17",
        index_id: "ipca",
        percent_of_index_bp: 10000,
        spread_bp: 600,
        day_count: "act365",
        face_value: 100000,
        daily_liquidity: false,
      },
    });
  });

  it("omits an empty grace date and an empty calendar", () => {
    const outcome = termsBody(draft, t);

    expect(outcome.body).not.toHaveProperty("redeemable_from");
    expect(outcome.body).not.toHaveProperty("calendar_id");
  });

  it("sends the calendar, the liquidity and the grace date", () => {
    const outcome = termsBody(
      {
        ...draft,
        calendar: "br_banking",
        dailyLiquidity: true,
        redeemableFrom: "2027-01-02",
      },
      t,
    );

    expect(outcome.body).toMatchObject({
      calendar_id: "br_banking",
      daily_liquidity: true,
      redeemable_from: "2027-01-02",
    });
  });

  it("omits the index of a pre-fixed security", () => {
    const outcome = termsBody({ ...draft, index: " " }, t);

    expect(outcome.body).not.toHaveProperty("index_id");
  });

  // Progressive rate design PR1, PR2: the PUT replaces the whole terms.
  it("keeps the rate steps of the stored terms", () => {
    const steps = {
      rate_steps: [
        { after_days: 180, percent_of_index_bp: 9500, spread_bp: 0 },
        { after_days: 360, percent_of_index_bp: 10100, spread_bp: 0 },
      ],
      rate_steps_apply: "retroactive" as const,
    };
    const stored = initialDraft(
      {
        issued_on: "2026-01-02",
        matures_on: "2028-01-02",
        index_id: "cdi",
        percent_of_index_bp: 9000,
        spread_bp: 0,
        day_count: "bus252",
        face_value: 100000,
        daily_liquidity: true,
        payments: [],
        ...steps,
      },
      "2026-11-23",
      "en-US",
    );

    const outcome = termsBody({ ...stored, matures: "2028-06-30" }, t);

    expect(outcome.body).toMatchObject({ matures_on: "2028-06-30", ...steps });
  });

  it("rejects a percent of zero", () => {
    expect(termsBody({ ...draft, percent: "0" }, t)).toEqual({
      errors: { percent_of_index_bp: catalogEn["terms.invalid.percent"] },
    });
  });

  it("requires a day count", () => {
    expect(termsBody({ ...draft, dayCount: null }, t)).toEqual({
      errors: { day_count: catalogEn["instruments.required"] },
    });
  });
});
