import type { components } from "@/api/schema.gen";
import { monthEnd } from "@/features/planning/agenda";
import type { BudgetState, Figures } from "@/features/planning/budget-month";
import { budgetState, usedShare } from "@/features/planning/budget-month";
import styles from "@/features/planning/budgets.module.css";
import type { MessageKey } from "@/i18n/catalog.en";
import { formatDate, numberFormatter } from "@/i18n/format";
import { useAppLocale, useT } from "@/i18n/i18n-provider";
import { useToday } from "@/i18n/today";
import { useMoneyFormat } from "@/privacy/use-money-format";
import { FigureCard } from "@/ui/figure-card";
import { FigureGrid } from "@/ui/figure-grid";

type Money = components["schemas"]["Money"];
type Committed = components["schemas"]["Committed"];
type Price = components["schemas"]["Price"];

export interface BudgetSummaryProps {
  // Undefined when no budget covers the month.
  figures: Figures | undefined;
  states: Record<BudgetState, number>;
  committed: Committed | undefined;
  month: string;
  scale: (code: string) => number;
}

// RP-02, OV-06: the month over every budget as four peer figures: what went out of the room, what
// is left, what installments and expected occurrences still commit, and how many budgets ran over.
export function BudgetSummary({
  figures,
  states,
  committed,
  month,
  scale,
}: BudgetSummaryProps) {
  const t = useT();
  const [locale] = useAppLocale();
  const today = useToday();
  const fmt = useMoneyFormat();

  if (figures === undefined) return null;

  const money = (m: Money) => fmt.money(m, scale(m.currency));
  const amount = (m: Money) => ({ money: m, scale: scale(m.currency) });
  const number = numberFormatter(locale);
  const state = budgetState(figures);
  const share = usedShare(figures);
  const room = {
    ...figures.planned,
    amount: figures.planned.amount + figures.carried.amount,
  };
  const left =
    state === "over"
      ? { ...figures.available, amount: -figures.available.amount }
      : figures.available;
  const current = today.slice(0, 7);
  const outside = t(
    month < current ? "budget.figure.monthPast" : "budget.figure.monthAhead",
  );
  const when =
    month === current
      ? t("budget.day", {
          day: String(Number(today.slice(8, 10))),
          days: String(Number(monthEnd(month).slice(8, 10))),
        })
      : outside;
  const count = (n: number, one: MessageKey, many: MessageKey) =>
    n === 1 ? t(one) : t(many, { count: number.format(n) });
  const rate = (p: Price) =>
    t("budget.price", {
      instrument: p.instrument,
      rate: numberFormatter(locale, {
        minimumFractionDigits: p.value.split(".")[1]?.length ?? 0,
      }).format(Number(p.value)),
      quote: p.quote_instrument,
      date: formatDate(p.date, locale),
    });

  return (
    <FigureGrid label={t("budget.summary")}>
      <FigureCard
        label={t("budget.figure.spent")}
        value={amount(figures.spent)}
        goodWhen="none"
        note={t("budget.figure.share", {
          share: numberFormatter(locale, { style: "percent" }).format(
            share / 100,
          ),
          room: money(room),
        })}
      />

      <FigureCard
        label={t(
          state === "over" ? "budget.figure.over" : "budget.figure.left",
        )}
        value={amount(left)}
        goodWhen="none"
        note={when}
      />

      <FigureCard
        label={t("budget.figure.committed")}
        value={committed === undefined ? undefined : amount(committed.total)}
        goodWhen="none"
        loading={committed === undefined}
        note={
          committed !== undefined && (
            <>
              {t("budget.figure.committedParts", {
                installments: money(committed.installments),
                expected: money(committed.occurrences),
              })}
              {(committed.prices ?? []).map((p) => (
                <span
                  key={`${p.instrument}-${p.date}`}
                  className={styles.price}
                >
                  {rate(p)}
                </span>
              ))}
            </>
          )
        }
      />

      <FigureCard
        label={t("budget.figure.overspent")}
        value={number.format(states.over)}
        goodWhen="none"
        note={[
          count(states.near, "budget.nearOne", "budget.nearMany"),
          count(states.within, "budget.withinOne", "budget.withinMany"),
        ].join(" · ")}
      />
    </FigureGrid>
  );
}
