import type { CardTotals } from "@/features/cards/card-totals";
import { useScale } from "@/features/setup";
import { formatDate } from "@/i18n/format";
import { useAppLocale, useT } from "@/i18n/i18n-provider";
import type { TFunction } from "@/i18n/i18n-provider";
import { useMoneyFormat } from "@/privacy/use-money-format";
import { FigureCard } from "@/ui/figure-card";
import { FigureGrid } from "@/ui/figure-grid";
import type { MoneyAmount } from "@/ui/money-value";

type Money = CardTotals["open"];

export interface CardsFiguresProps {
  // Undefined until the base currency is read.
  totals: CardTotals | undefined;
  loading: boolean;
}

// The figures of the cards destination: what the open statements hold, what is due, and the free
// limit. What is due past its date and a free limit below zero are flagged.
export function CardsFigures({ totals, loading }: CardsFiguresProps) {
  const t = useT();
  const [locale] = useAppLocale();
  const fmt = useMoneyFormat();
  const scale = useScale() ?? (() => 2);

  const money = (m: Money) => fmt.money(m, scale(m.currency));
  const figure = (m: Money): MoneyAmount | undefined =>
    totals === undefined || loading
      ? undefined
      : { money: m, scale: scale(m.currency) };
  const overdueSince = totals?.overdueSince;
  const overLimit = totals !== undefined && totals.available.amount < 0;
  const dueNote = dueNoteOf(totals, t, locale);
  const limitNote =
    totals === undefined
      ? t("cards.limitNone")
      : t("cards.limitOf", { limit: money(totals.limit) });
  const availableNote = overLimit
    ? t("accountCard.meter.credit.over", {
        amount: money({
          ...totals.available,
          amount: -totals.available.amount,
        }),
      })
    : limitNote;

  return (
    <FigureGrid label={t("cards.figures")}>
      <FigureCard
        label={t("cards.figure.open")}
        value={totals && figure(totals.open)}
        note={t("cards.openNote")}
        loading={loading}
      />
      <FigureCard
        label={t("cards.figure.due")}
        value={totals && figure(totals.due)}
        note={dueNote}
        attention={overdueSince === undefined ? undefined : "danger"}
        loading={loading}
      />
      <FigureCard
        label={t("cards.figure.available")}
        value={totals && figure(totals.available)}
        note={availableNote}
        attention={overLimit ? "danger" : undefined}
        loading={loading}
      />
    </FigureGrid>
  );
}

function dueNoteOf(
  totals: CardTotals | undefined,
  t: TFunction,
  locale: string,
): string {
  if (totals?.overdueSince !== undefined)
    return t("statement.overdueSince", {
      date: formatDate(totals.overdueSince, locale),
    });

  if (totals?.nearestDue !== undefined)
    return t("cards.dueNote", { date: formatDate(totals.nearestDue, locale) });

  return t("cards.nothingDue");
}
