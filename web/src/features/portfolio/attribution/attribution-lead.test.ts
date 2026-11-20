import { describe, expect, it } from "vitest";

import { attributionLead } from "@/features/portfolio/attribution/attribution-lead";
import type { TFunction } from "@/i18n/i18n-provider";

const t: TFunction = (key, vars) =>
  `${key}${vars === undefined ? "" : JSON.stringify(vars)}`;
const money = (amount: number) => `R$${String(amount)}`;
const dayMonth = (iso: string) => iso.slice(5);

function year(to: string, amount: number) {
  return {
    year: Number(to.slice(0, 4)),
    from: `${to.slice(0, 4)}-01-01`,
    to,
    result: { amount, currency: "BRL" },
  };
}

describe("attributionLead", () => {
  it("writes a closed year with gains and losses", () => {
    const got = attributionLead(
      year("2025-12-31", 915128),
      { count: 22, sum: 966558 },
      { count: 3, sum: -51430 },
      t,
      money,
      dayMonth,
    );

    expect(got.period).toBe("2025");
    expect(got.lead).toBe(
      'portfolio.attribution.lead.gain{"period":"2025","amount":"R$915128"}',
    );
    expect(got.tally).toBe(
      `portfolio.attribution.tally.both${JSON.stringify({
        gains:
          'portfolio.attribution.gains.other{"count":"22","amount":"R$966558"}',
        losses:
          'portfolio.attribution.losses.other{"count":"3","amount":"R$51430"}',
      })}`,
    );
  });

  it("names the last day of a partial year and a loss", () => {
    const got = attributionLead(
      year("2026-11-20", -5000),
      { count: 0, sum: 0 },
      { count: 1, sum: -5000 },
      t,
      money,
      dayMonth,
    );

    expect(got.period).toBe(
      'portfolio.attribution.period.partial{"year":"2026","day":"11-20"}',
    );
    expect(got.lead.startsWith("portfolio.attribution.lead.loss")).toBe(true);
    expect(got.lead.endsWith('"amount":"R$5000"}')).toBe(true);
    expect(got.tally).toBe(
      `portfolio.attribution.tally.one${JSON.stringify({
        part: 'portfolio.attribution.losses.one{"count":"1","amount":"R$5000"}',
      })}`,
    );
  });

  it("writes no tally without holdings", () => {
    const got = attributionLead(
      year("2025-12-31", 0),
      { count: 0, sum: 0 },
      { count: 0, sum: 0 },
      t,
      money,
      dayMonth,
    );

    expect(got.tally).toBeUndefined();
  });
});
