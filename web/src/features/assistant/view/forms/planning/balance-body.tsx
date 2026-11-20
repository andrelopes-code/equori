import { balanceGeometry } from "@/features/assistant/view/forms/planning/balance-path";
import type { BalanceData } from "@/features/assistant/view/forms/planning/planning-data";
import styles from "@/features/assistant/view/forms/forms.module.css";
import { useValueFormat } from "@/features/assistant/view/use-value-format";
import type { FormBodyProps } from "@/features/assistant/view/view-forms";
import { formatDate } from "@/i18n/format";
import { useAppLocale, useT } from "@/i18n/i18n-provider";

// An account's balance ahead as a step line, since a balance changes only at events; the lowest
// point marked and written, each step read by hover or focus on one line above the plot.
export function BalanceBody({ data }: FormBodyProps) {
  const t = useT();
  const [locale] = useAppLocale();
  const format = useValueFormat();
  const d = data as BalanceData;
  const g = balanceGeometry(d);

  const balances = [d.opening.amount, ...d.points.map((p) => p.balance.amount)];
  const top = { ...d.opening, amount: Math.max(0, ...balances) };
  const bottom = { ...d.opening, amount: Math.min(0, ...balances) };
  const steps = [
    {
      date: d.from,
      description: t("assistantView.balance.today"),
      balance: d.opening,
    },
    ...d.points,
  ];

  return (
    <div>
      <div className={styles.canvas}>
        <svg
          className={styles.line}
          viewBox="0 0 300 120"
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          {g.zero !== undefined && (
            <line
              className={styles.zeroLine}
              x1="0"
              x2="300"
              y1={g.zero}
              y2={g.zero}
            />
          )}
          <path className={styles.lineArea} d={g.area} />
          <path className={styles.lineSubject} d={g.path} />
        </svg>
        <span
          className={styles.mark}
          style={{
            insetInlineStart: `${String((g.low.x / 300) * 100)}%`,
            insetBlockStart: `${String(g.low.y)}px`,
          }}
        />
        <span
          className={styles.markLabel}
          style={{
            insetInlineStart: `${String((g.low.x / 300) * 100)}%`,
            insetBlockStart: `${String(g.low.y)}px`,
          }}
        >
          {t("assistantView.balance.low", {
            amount: format.money(d.low.balance),
          })}
        </span>
        <span className={styles.yAxis} aria-hidden="true">
          <span>{format.whole(top, false)}</span>
          <span>{format.whole(bottom, false)}</span>
        </span>
        <div className={styles.readout}>
          {steps.map((s, i) => (
            <span
              key={`${s.date}-${String(i)}`}
              className={styles.hit}
              tabIndex={0}
            >
              <i
                className={styles.guide}
                style={{
                  insetInlineStart: `${String(((g.xs[i] ?? 0) / 300) * 100)}%`,
                }}
              />
              <span className={styles.readoutTip}>
                {t("assistantView.balance.tip", {
                  date: formatDate(s.date, locale),
                  name: s.description,
                  amount: format.money(s.balance),
                })}
              </span>
            </span>
          ))}
        </div>
      </div>

      <div className={styles.xAxis}>
        <span>{formatDate(d.from, locale)}</span>
        <span>{formatDate(d.to, locale)}</span>
      </div>
    </div>
  );
}
