import { useAccountYield } from "@/features/portfolio/use-account-yield";
import { yieldNote } from "@/features/portfolio/yield-note";
import { formatBasisPoints, shiftDate } from "@/i18n/format";
import { useAppLocale, useT } from "@/i18n/i18n-provider";
import { FigureCard } from "@/ui/figure-card";

interface AccountYieldFigureProps {
  accountId: string;
  today: string;
}

// The yield of an account over the last 12 months, among the figures of its page: the rate a
// year on the index's basis, and in the note the percent of the index, the index's own rate a
// year and the days compared (amendment A208 R10).
export function AccountYieldFigure({
  accountId,
  today,
}: AccountYieldFigureProps) {
  const t = useT();
  const [tag] = useAppLocale();
  const report = useAccountYield(accountId, shiftDate(today, -364), today);

  const benchmark = report?.benchmark;
  if (benchmark?.annual_bp === undefined) return null;

  return (
    <FigureCard
      label={t("portfolio.yield.figure")}
      value={t("portfolio.yield.annual", {
        rate: formatBasisPoints(benchmark.annual_bp, tag),
      })}
      note={yieldNote(benchmark, t, tag)}
    />
  );
}
