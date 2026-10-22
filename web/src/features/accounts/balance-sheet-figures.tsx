import type { Sides } from "@/features/accounts/balance-sheet";
import { formatDate } from "@/i18n/format";
import { useAppLocale, useT } from "@/i18n/i18n-provider";
import { FigureCard } from "@/ui/figure-card";
import { FigureGrid } from "@/ui/figure-grid";
import { useMoneyFormat } from "@/privacy/use-money-format";

function change(now: number, before: number | undefined): number | undefined {
  if (before === undefined || before === 0) return undefined;
  return (now - before) / Math.abs(before);
}

// What the household holds, owes and is worth on the date, each against 30 days earlier (RE-04).
export function BalanceSheetFigures({
  now,
  before,
  beforeDate,
  currency,
  scale,
  loading,
}: {
  now: Sides | undefined;
  before: Sides | undefined;
  beforeDate: string;
  currency: string;
  scale: number;
  loading: boolean;
}) {
  const t = useT();
  const [locale] = useAppLocale();
  const fmt = useMoneyFormat();
  const money = (amount: number) => fmt.money({ amount, currency }, scale);
  const note = (amount: number | undefined) =>
    amount === undefined
      ? t("balanceSheet.noComparison")
      : t("balanceSheet.compared", {
          amount: money(amount),
          date: formatDate(beforeDate, locale),
        });
  return (
    <FigureGrid label={t("balanceSheet.figures")}>
      <FigureCard
        label={t("balanceSheet.assets")}
        value={now === undefined ? undefined : money(now.assets)}
        note={note(before?.assets)}
        delta={
          now === undefined ? undefined : change(now.assets, before?.assets)
        }
        loading={loading}
      />
      <FigureCard
        label={t("balanceSheet.liabilities")}
        value={now === undefined ? undefined : money(now.liabilities)}
        note={note(before?.liabilities)}
        delta={
          now === undefined
            ? undefined
            : change(now.liabilities, before?.liabilities)
        }
        goodWhen="down"
        loading={loading}
      />
      <FigureCard
        label={t("balanceSheet.net")}
        value={now === undefined ? undefined : money(now.net)}
        note={note(before?.net)}
        delta={now === undefined ? undefined : change(now.net, before?.net)}
        loading={loading}
      />
    </FigureGrid>
  );
}
