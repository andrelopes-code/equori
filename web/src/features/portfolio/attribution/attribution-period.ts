import type { components } from "@/api/schema.gen";
import type { TFunction } from "@/i18n/i18n-provider";

type AttributionYear = components["schemas"]["AttributionYear"];

// The measured days of a year (AT13): "2025", "2026 até 20/11", "2021, desde 09/11" or
// "2021, de 09/11 a 20/11".
export function attributionPeriod(
  year: AttributionYear,
  t: TFunction,
  dayMonth: (iso: string) => string,
): string {
  const name = String(year.year);
  const since = year.since ?? year.from;
  const late = since !== year.from;
  const partial = !year.to.endsWith("-12-31");

  if (late && partial)
    return t("portfolio.attribution.period.between", {
      year: name,
      since: dayMonth(since),
      day: dayMonth(year.to),
    });

  if (late)
    return t("portfolio.attribution.period.since", {
      year: name,
      since: dayMonth(since),
    });

  if (partial)
    return t("portfolio.attribution.period.partial", {
      year: name,
      day: dayMonth(year.to),
    });

  return name;
}
