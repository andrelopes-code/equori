import {
  biggestRise,
  projectMonth,
} from "@/features/categories/category-figures";
import type { Summary } from "@/features/categories/category-figures";
import type { CategoryClass } from "@/features/categories/category-paths";
import { FigureCard } from "@/ui/figure-card";
import styles from "@/features/categories/figures-row.module.css";
import { PendingCard } from "@/features/categories/pending-card";
import { formatMonthName } from "@/i18n/format";
import { useAppLocale, useT } from "@/i18n/i18n-provider";
import { useMoneyFormat } from "@/privacy/use-money-format";

// OV-05: peer tiles in one grid. Each answers a question the tree and the charts leave to
// arithmetic: how the month compares with the same days before, what drove it, where it is
// heading, and what still waits for a category.
export function FiguresRow({
  cls,
  currency,
  scale,
  previousMonth,
  comparable,
  from,
  to,
  days,
  monthDays,
  current,
  previous,
  pending,
  loading,
}: {
  cls: CategoryClass;
  currency: string;
  scale: number;
  // YYYY-MM of the month before the one read.
  previousMonth: string;
  // The days of the month before that the month read is compared with.
  comparable: { from: string; to: string };
  from: string;
  to: string;
  // The days gone by in the month read, and the days it has.
  days: number;
  monthDays: number;
  current: Summary;
  // The comparable days of the month before; undefined until they have been read.
  previous: Summary | undefined;
  // What no category decided yet, as the class reads it; null when nothing waits.
  pending: { amount: number; share: number } | null;
  loading: boolean;
}) {
  const t = useT();
  const [locale] = useAppLocale();
  const fmt = useMoneyFormat();
  const money = (amount: number) => fmt.money({ amount, currency }, scale);
  const before = formatMonthName(previousMonth, locale).toLocaleLowerCase(
    locale,
  );
  const hasPrevious = previous !== undefined && previous.total !== 0;
  const running = days > 0 && days < monthDays;
  // Income arrives in lumps, so a straight line over its first days says nothing.
  const projected =
    cls === "expense" && running
      ? projectMonth(current.total, days, monthDays)
      : undefined;
  const rise = biggestRise(current, previous);
  const previousNote = (): string => {
    if (!hasPrevious) return t("category.kpi.noPrevious", { month: before });
    const amount = money(previous.total);
    return running
      ? t("category.kpi.previousToDate", {
          amount,
          month: before,
          day: Number(comparable.to.slice(8, 10)),
        })
      : t("category.kpi.previous", { amount, month: before });
  };
  return (
    <div className={styles.row}>
      <FigureCard
        label={t(
          cls === "income" ? "category.kpi.earned" : "category.kpi.spent",
        )}
        value={money(current.total)}
        loading={loading || previous === undefined}
        goodWhen={cls === "income" ? "up" : "down"}
        delta={
          hasPrevious
            ? (current.total - previous.total) / previous.total
            : undefined
        }
        note={previousNote()}
      />
      {projected !== undefined && (
        <FigureCard
          label={t("category.kpi.projection")}
          value={money(projected)}
          loading={loading}
          note={t("category.kpi.projectionNote", {
            rate: money(Math.round(current.total / days)),
          })}
        />
      )}
      <FigureCard
        label={t("category.kpi.rise")}
        value={rise?.entry.name}
        loading={loading || previous === undefined}
        note={
          rise !== undefined
            ? t("category.kpi.riseNote", {
                amount: money(rise.amount),
                month: before,
              })
            : hasPrevious
              ? t("category.kpi.noRise", { month: before })
              : t("category.kpi.noPrevious", { month: before })
        }
      />
      {pending !== null && (
        <PendingCard
          amount={pending.amount}
          share={pending.share}
          cls={cls}
          currency={currency}
          scale={scale}
          from={from}
          to={to}
        />
      )}
    </div>
  );
}
