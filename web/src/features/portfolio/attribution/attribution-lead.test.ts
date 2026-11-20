import { describe, expect, it } from "vitest";

import type { components } from "@/api/schema.gen";
import {
  attributionLead,
  type AttributionFormat,
} from "@/features/portfolio/attribution/attribution-lead";
import type { TFunction } from "@/i18n/i18n-provider";

type AttributionYear = components["schemas"]["AttributionYear"];

const t: TFunction = (key, vars) =>
  `${key}${vars === undefined ? "" : JSON.stringify(vars)}`;
const f: AttributionFormat = {
  money: (amount) => `R$${String(amount)}`,
  percent: (bp) => `${String(bp)}bp`,
  dayMonth: (iso) => iso.slice(5),
  indexName: (code) => code.toUpperCase(),
};
const brl = (amount: number) => ({ amount, currency: "BRL" });
const none = { count: 0, sum: 0 };

function compare(
  until: string,
  result: number,
  indexResult: number,
  real?: number,
) {
  return {
    index: real === undefined ? "cdi" : "ipca",
    until,
    return_bp: 0,
    result: brl(result),
    index_bp: 1438,
    index_result: brl(indexResult),
    ...(real === undefined ? {} : { real_bp: real }),
  };
}

const closed: AttributionYear = {
  year: 2025,
  from: "2025-01-01",
  to: "2025-12-31",
  since: "2025-01-01",
  result: brl(915128),
  return_bp: 1361,
  rate: compare("2025-12-31", 915128, 1020000),
  inflation: compare("2025-12-31", 915128, 300000, 925),
};

describe("attributionLead", () => {
  it("writes a closed year, its comparisons and its tally", () => {
    const got = attributionLead(
      closed,
      { count: 22, sum: 966558 },
      { count: 3, sum: -51430 },
      t,
      f,
    );

    expect(got.period).toBe("2025");
    expect(got.lead).toBe(
      'portfolio.attribution.lead.gain{"period":"2025","amount":"R$915128","rate":"1361bp"}',
    );
    // 9,151.28 against 10,200.00 at the CDI: 1,048.72 below.
    expect(got.compare).toBe(
      `portfolio.attribution.join.two${JSON.stringify({
        first:
          'portfolio.attribution.compare.below{"amount":"R$104872","index":"CDI","window":"","indexRate":"1438bp"}',
        second:
          'portfolio.attribution.compare.real{"index":"IPCA","window":"","inflation":"1438bp","real":"925bp"}',
      })}`,
    );
    expect(got.tally).toBe(
      `portfolio.attribution.join.two${JSON.stringify({
        first:
          'portfolio.attribution.gains.other{"count":"22","amount":"R$966558"}',
        second:
          'portfolio.attribution.losses.other{"count":"3","amount":"R$51430"}',
      })}`,
    );
  });

  it("names the last day of a partial year and of each comparison that ends before it", () => {
    const got = attributionLead(
      {
        ...closed,
        year: 2026,
        from: "2026-01-01",
        to: "2026-11-20",
        since: "2026-01-01",
        result: brl(-5000),
        return_bp: -50,
        rate: compare("2026-11-18", -5000, -5000),
        inflation: compare("2026-10-31", -4000, 1000, -81),
      },
      none,
      { count: 1, sum: -5000 },
      t,
      f,
    );

    expect(got.period).toBe(
      'portfolio.attribution.period.partial{"year":"2026","day":"11-20"}',
    );
    expect(got.lead.startsWith("portfolio.attribution.lead.loss{")).toBe(true);
    expect(got.compare).toContain(
      'portfolio.attribution.compare.equal{\\"amount\\":\\"R$0\\",\\"index\\":\\"CDI\\",\\"window\\":\\"portfolio.attribution.window{\\\\\\"day\\\\\\":\\\\\\"11-18\\\\\\"}\\"',
    );
    expect(got.compare).toContain('\\"real\\":\\"-81bp\\"');
    expect(got.tally).toBe(
      `portfolio.attribution.join.one${JSON.stringify({
        part: 'portfolio.attribution.losses.one{"count":"1","amount":"R$5000"}',
      })}`,
    );
  });

  it("names the first day of a year whose money came late, without a rate or a comparison", () => {
    const got = attributionLead(
      {
        year: 2021,
        from: "2021-01-01",
        to: "2021-12-31",
        since: "2021-11-09",
        result: brl(652),
      },
      none,
      none,
      t,
      f,
    );

    expect(got.period).toBe(
      'portfolio.attribution.period.since{"year":"2021","since":"11-09"}',
    );
    expect(got.lead).toBe(
      `portfolio.attribution.lead.gain.bare{"period":${JSON.stringify(got.period)},"amount":"R$652"}`,
    );
    expect(got.compare).toBeUndefined();
    expect(got.tally).toBeUndefined();
  });
});
