import type { components } from "@/api/schema.gen";
import type { AttributionTally } from "@/features/portfolio/attribution/attribution-rows";
import type { TFunction } from "@/i18n/i18n-provider";

type AttributionYear = components["schemas"]["AttributionYear"];

export interface AttributionLead {
  // "2025", or "2026 até 20/11" for the current year.
  period: string;
  lead: string;
  tally: string | undefined;
}

// The two sentences above the rows: what the portfolio made in the year, then how many holdings
// added and how many took away. A count of zero is left out; no holding leaves no second sentence.
export function attributionLead(
  year: AttributionYear,
  gains: AttributionTally,
  losses: AttributionTally,
  t: TFunction,
  money: (amount: number) => string,
  dayMonth: (iso: string) => string,
): AttributionLead {
  const partial = !year.to.endsWith("-12-31");
  const period = partial
    ? t("portfolio.attribution.period.partial", {
        year: String(year.year),
        day: dayMonth(year.to),
      })
    : String(year.year);
  const result = year.result?.amount ?? 0;
  const lead = t(
    result < 0
      ? "portfolio.attribution.lead.loss"
      : "portfolio.attribution.lead.gain",
    { period, amount: money(Math.abs(result)) },
  );
  const parts = [
    part(t, "gains", gains, money),
    part(t, "losses", losses, money),
  ].filter((p) => p !== undefined);

  return { period, lead, tally: tallyOf(t, parts) };
}

function part(
  t: TFunction,
  kind: "gains" | "losses",
  tally: AttributionTally,
  money: (amount: number) => string,
): string | undefined {
  if (tally.count === 0) return undefined;

  return t(
    tally.count === 1
      ? `portfolio.attribution.${kind}.one`
      : `portfolio.attribution.${kind}.other`,
    { count: String(tally.count), amount: money(Math.abs(tally.sum)) },
  );
}

function tallyOf(t: TFunction, parts: string[]): string | undefined {
  const [first, second] = parts;
  if (first === undefined) return undefined;
  if (second === undefined)
    return t("portfolio.attribution.tally.one", { part: first });

  return t("portfolio.attribution.tally.both", {
    gains: first,
    losses: second,
  });
}
