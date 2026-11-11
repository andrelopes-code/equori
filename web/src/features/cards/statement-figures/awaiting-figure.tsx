import type { components } from "@/api/schema.gen";
import { useT } from "@/i18n/i18n-provider";
import { useMoneyFormat } from "@/privacy/use-money-format";
import { FigureCard } from "@/ui/figure-card";

type Statement = components["schemas"]["StatementDetail"];

interface AwaitingFigureProps {
  statement: Statement;
  scale: (code: string) => number;
}

// A170: what of the statement's activity still waits for the bank, beside what it confirmed.
export function AwaitingFigure({ statement, scale }: AwaitingFigureProps) {
  const t = useT();
  const fmt = useMoneyFormat();
  const { confirmed_amount: confirmed, awaiting_amount: awaiting } = statement;
  if (confirmed === undefined || awaiting === undefined) return null;
  if (awaiting.amount === 0) return null;

  return (
    <FigureCard
      label={t("statement.awaiting")}
      value={{ money: awaiting, scale: scale(awaiting.currency) }}
      note={t("statement.confirmedNote", {
        confirmed: fmt.money(confirmed, scale(confirmed.currency)),
      })}
    />
  );
}
