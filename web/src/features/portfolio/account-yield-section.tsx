import { useAccountYield } from "@/features/portfolio/use-account-yield";
import { yieldCards } from "@/features/portfolio/yield-figures";
import { shiftDate } from "@/i18n/format";
import { useAppLocale, useT } from "@/i18n/i18n-provider";
import { useToday } from "@/i18n/today";
import { FigureCard } from "@/ui/figure-card";
import { FigureGrid } from "@/ui/figure-grid";

interface AccountYieldSectionProps {
  accountId: string;
}

// The yield of an account over the last 12 months, as a section of its page (amendment A208
// R17): the rate a year or the return, the percent of the index or the difference from it, and
// the real return. A negative figure is marked in the danger tone and its note says what it is.
export function AccountYieldSection({ accountId }: AccountYieldSectionProps) {
  const t = useT();
  const [tag] = useAppLocale();
  const today = useToday();
  const report = useAccountYield(accountId, shiftDate(today, -364), today);

  const cards = report === undefined ? [] : yieldCards(report, t, tag);
  if (cards.length === 0) return null;

  return (
    <FigureGrid label={t("portfolio.yield.figure")}>
      {cards.map((card) => (
        <FigureCard
          key={card.key}
          label={card.label}
          value={card.value}
          note={card.note}
          goodWhen="none"
          attention={card.negative ? "danger" : undefined}
        />
      ))}
    </FigureGrid>
  );
}
