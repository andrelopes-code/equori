import type { components } from "@/api/schema.gen";
import { useLoanFigures } from "@/features/accounts/kind-figures/use-loan-figures";
import { formatReferenceMonth, numberFormatter } from "@/i18n/format";
import { useAppLocale, useT } from "@/i18n/i18n-provider";
import { useMoneyFormat } from "@/privacy/use-money-format";
import { FigureCard } from "@/ui/display/figure-card";
import { FigureGrid } from "@/ui/display/figure-grid";

type Account = components["schemas"]["Account"];

interface LoanFiguresProps {
  account: Account;
  scale: number;
}

// The figures of a loan: what it still owes, how much of it was repaid, when it ends and the
// interest paid so far (K5 to K7).
export function LoanFigures({ account, scale }: LoanFiguresProps) {
  const t = useT();
  const [locale] = useAppLocale();
  const fmt = useMoneyFormat();
  const { figures, remaining, loading } = useLoanFigures(account);

  const currency = account.currency;
  const amount = (n: number) => ({ money: { amount: n, currency }, scale });
  const money = (n: number) => fmt.money({ amount: n, currency }, scale);
  const percent = numberFormatter(locale, {
    style: "percent",
    maximumFractionDigits: 1,
  });

  return (
    <FigureGrid label={t("loan.figures")}>
      <FigureCard
        label={t("loan.outstanding")}
        value={figures === undefined ? undefined : amount(figures.outstanding)}
        note={
          figures === undefined
            ? t("loan.noFigures")
            : t("loan.financed", { amount: money(figures.financed) })
        }
        goodWhen="down"
        loading={loading}
      />
      <FigureCard
        label={t("loan.repaid")}
        value={
          figures?.fraction === undefined
            ? undefined
            : percent.format(figures.fraction)
        }
        note={
          figures === undefined
            ? t("loan.noFigures")
            : t("loan.repaidNote", { amount: money(figures.repaid) })
        }
        loading={loading}
      />
      <FigureCard
        label={t("loan.payoff")}
        value={
          remaining === undefined
            ? undefined
            : formatReferenceMonth(remaining.last.slice(0, 7), locale)
        }
        note={
          remaining === undefined
            ? t("loan.noSchedule")
            : t(
                remaining.count === 1
                  ? "loan.payoffNoteOne"
                  : "loan.payoffNote",
                {
                  count: remaining.count,
                  amount: fmt.money(remaining.amount, scale),
                },
              )
        }
      />
      {figures !== undefined && figures.payments > 0 && (
        <FigureCard
          label={t("loan.interest")}
          value={amount(figures.interest)}
          note={t(
            figures.payments === 1
              ? "loan.interestNoteOne"
              : "loan.interestNote",
            { count: figures.payments },
          )}
          goodWhen="none"
        />
      )}
    </FigureGrid>
  );
}
