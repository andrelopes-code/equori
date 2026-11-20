import type { components } from "@/api/schema.gen";
import type { AttributionTally } from "@/features/portfolio/attribution/attribution-rows";
import type { TFunction } from "@/i18n/i18n-provider";

type AttributionYear = components["schemas"]["AttributionYear"];
type AttributionCompare = components["schemas"]["AttributionCompare"];

export interface AttributionFormat {
  money: (amount: number) => string;
  percent: (bp: number) => string;
  dayMonth: (iso: string) => string;
  indexName: (code: string) => string;
}

export interface AttributionLead {
  // "2025", "2026 até 20/11" or "2021, desde 09/11".
  period: string;
  lead: string;
  compare: string | undefined;
  tally: string | undefined;
}

// The sentences above the rows: what the portfolio made in the measured days (AT8, AT13), how it
// stands beside the same money at the CDI and the IPCA over each comparison's own days (AT10 to
// AT12), and how many holdings added or took away. A part without its figure is left out.
export function attributionLead(
  year: AttributionYear,
  gains: AttributionTally,
  losses: AttributionTally,
  t: TFunction,
  f: AttributionFormat,
): AttributionLead {
  const period = periodOf(year, t, f);
  const result = year.result?.amount ?? 0;
  const amount = f.money(Math.abs(result));
  const verb = result < 0 ? "loss" : "gain";
  const lead =
    year.return_bp === undefined
      ? t(`portfolio.attribution.lead.${verb}.bare`, { period, amount })
      : t(`portfolio.attribution.lead.${verb}`, {
          period,
          amount,
          rate: f.percent(year.return_bp),
        });

  return {
    period,
    lead,
    compare: joined(t, [rateText(year, t, f), inflationText(year, t, f)]),
    tally: joined(t, [
      tallyText(t, "gains", gains, f),
      tallyText(t, "losses", losses, f),
    ]),
  };
}

function periodOf(
  year: AttributionYear,
  t: TFunction,
  f: AttributionFormat,
): string {
  const name = String(year.year);
  const late = year.since !== undefined && year.since !== year.from;
  const partial = !year.to.endsWith("-12-31");

  if (late && partial)
    return t("portfolio.attribution.period.between", {
      year: name,
      since: f.dayMonth(year.since ?? year.from),
      day: f.dayMonth(year.to),
    });

  if (late)
    return t("portfolio.attribution.period.since", {
      year: name,
      since: f.dayMonth(year.since ?? year.from),
    });

  if (partial)
    return t("portfolio.attribution.period.partial", {
      year: name,
      day: f.dayMonth(year.to),
    });

  return name;
}

// The days of a comparison that ends before the year: " até 18/11".
function windowOf(
  c: AttributionCompare,
  year: AttributionYear,
  t: TFunction,
  f: AttributionFormat,
): string {
  if (c.until === year.to) return "";

  return t("portfolio.attribution.window", { day: f.dayMonth(c.until) });
}

function rateText(
  year: AttributionYear,
  t: TFunction,
  f: AttributionFormat,
): string | undefined {
  const c = year.rate;
  if (c === undefined) return undefined;

  const diff = c.result.amount - c.index_result.amount;
  const vars = {
    amount: f.money(Math.abs(diff)),
    index: f.indexName(c.index),
    window: windowOf(c, year, t, f),
    indexRate: f.percent(c.index_bp),
  };

  if (diff === 0) return t("portfolio.attribution.compare.equal", vars);

  return t(
    diff > 0
      ? "portfolio.attribution.compare.above"
      : "portfolio.attribution.compare.below",
    vars,
  );
}

function inflationText(
  year: AttributionYear,
  t: TFunction,
  f: AttributionFormat,
): string | undefined {
  const c = year.inflation;
  if (c?.real_bp === undefined) return undefined;

  return t("portfolio.attribution.compare.real", {
    index: f.indexName(c.index),
    window: windowOf(c, year, t, f),
    inflation: f.percent(c.index_bp),
    real: f.percent(c.real_bp),
  });
}

function tallyText(
  t: TFunction,
  kind: "gains" | "losses",
  tally: AttributionTally,
  f: AttributionFormat,
): string | undefined {
  if (tally.count === 0) return undefined;

  return t(
    tally.count === 1
      ? `portfolio.attribution.${kind}.one`
      : `portfolio.attribution.${kind}.other`,
    { count: String(tally.count), amount: f.money(Math.abs(tally.sum)) },
  );
}

function joined(
  t: TFunction,
  parts: (string | undefined)[],
): string | undefined {
  const [first, second] = parts.filter((p) => p !== undefined);
  if (first === undefined) return undefined;
  if (second === undefined)
    return t("portfolio.attribution.join.one", { part: first });

  return t("portfolio.attribution.join.two", { first, second });
}
