import type { Commitments } from "@/features/planning/schedules/commitments";
import { SummaryBand } from "@/features/planning/summary/summary-band";
import { formatBasisPoints } from "@/i18n/format";
import { useAppLocale, useT } from "@/i18n/i18n-provider";
import { useMoneyFormat } from "@/privacy/use-money-format";

interface SchedulesSummaryProps {
  commitments: Commitments | undefined;
  scale: ((code: string) => number) | null;
  loading: boolean;
}

// The schedules' band: what is left free each month, the fixed income, the bills and
// subscriptions with their share of it, and the savings (spec B1).
export function SchedulesSummary({
  commitments: c,
  scale,
  loading,
}: SchedulesSummaryProps) {
  const t = useT();
  const [locale] = useAppLocale();
  const fmt = useMoneyFormat();

  const ready = c !== undefined && scale !== null;
  const amount = (value: number) =>
    ready
      ? {
          money: { amount: value, currency: c.currency },
          scale: scale(c.currency),
        }
      : undefined;
  const count = (n: number) =>
    n === 1
      ? t("schedules.countOne")
      : t("schedules.countMany", { count: String(n) });
  const freeNote =
    ready && c.leftOut.length > 0
      ? t("schedules.leftOut", {
          amounts: c.leftOut
            .map((m) => fmt.money(m, scale(m.currency)))
            .join(", "),
        })
      : t("schedules.freeNote");

  return (
    <SummaryBand
      label={t("schedules.figures")}
      loading={loading || !ready}
      figures={[
        {
          key: "free",
          label: t("schedules.free"),
          value: amount(c?.free ?? 0),
          note: freeNote,
        },
        {
          key: "income",
          label: t("schedules.income"),
          value: amount(c?.income ?? 0),
          note: count(c?.counts.income ?? 0),
        },
        {
          key: "bills",
          label: t("schedules.billsSubs"),
          value: amount((c?.bills ?? 0) + (c?.subscriptions ?? 0)),
          note:
            c?.shareBp === undefined
              ? t("schedules.noIncome")
              : t("schedules.share", {
                  percent: formatBasisPoints(c.shareBp, locale),
                }),
        },
        {
          key: "savings",
          label: t("schedules.savings"),
          value: amount(c?.savings ?? 0),
          note: count(c?.counts.savings ?? 0),
        },
      ]}
    />
  );
}
