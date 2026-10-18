import { Link } from "@slotted/react/link";

import type { components } from "@/api/schema.gen";
import type { Statement } from "@/features/cards/statement-groups";
import { formatDayMonth } from "@/i18n/format";
import { useAppLocale, useT } from "@/i18n/i18n-provider";
import { FigureStrip } from "@/ui/figure-strip";
import { FigureStripItem } from "@/ui/figure-strip-item";
import { MoneyFigure } from "@/ui/money-figure";
import { useSpaLink } from "@/ui/use-spa-link";
import { useViewport } from "@/ui/use-viewport";

type Account = components["schemas"]["Account"];

// Complete frontend C2: the statement amount, its closing and due dates and the available limit.
export function CardFigures({
  account,
  statement,
  scale,
}: {
  account: Account;
  statement: Statement;
  scale: (currency: string) => number;
}) {
  const t = useT();
  const [locale] = useAppLocale();
  const viewport = useViewport();
  const spaLink = useSpaLink();
  const available = account.card?.available_limit;
  return (
    <FigureStrip label={t("cards.figures")} ruled={false}>
      <FigureStripItem label={t("cards.current.amountDue")}>
        <MoneyFigure
          money={statement.amount_due}
          scale={scale(statement.amount_due.currency)}
          size={viewport === "desktop" ? "xl" : "lg"}
        />
      </FigureStripItem>
      <FigureStripItem label={t("cards.figure.closes")}>
        {formatDayMonth(statement.closing_date, locale)}
      </FigureStripItem>
      <FigureStripItem label={t("cards.figure.due")}>
        {formatDayMonth(statement.due_date, locale)}
      </FigureStripItem>
      <FigureStripItem label={t("cards.figure.available")}>
        {available === undefined ? (
          <Link {...spaLink(`/cards/${account.id}/settings`)}>
            {t("cards.stat.nolimit")}
          </Link>
        ) : (
          <MoneyFigure
            money={available}
            scale={scale(available.currency)}
            size="md"
          />
        )}
      </FigureStripItem>
    </FigureStrip>
  );
}
