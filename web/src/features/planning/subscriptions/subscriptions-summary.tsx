import type { SubscriptionFigures } from "@/features/planning/subscriptions/subscription-figures";
import { SummaryBand } from "@/features/planning/summary/summary-band";
import { useT } from "@/i18n/i18n-provider";
import { useMoneyFormat } from "@/privacy/use-money-format";

interface SubscriptionsSummaryProps {
  figures: SubscriptionFigures | undefined;
  scale: ((code: string) => number) | null;
  loading: boolean;
}

// The subscriptions' band: the monthly cost, the yearly cost, what was charged in the last 12
// months, and what the ended ones no longer cost (spec C1).
export function SubscriptionsSummary({
  figures: f,
  scale,
  loading,
}: SubscriptionsSummaryProps) {
  const t = useT();
  const fmt = useMoneyFormat();

  const ready = f !== undefined && scale !== null;
  const amount = (value: number) =>
    ready
      ? {
          money: { amount: value, currency: f.currency },
          scale: scale(f.currency),
        }
      : undefined;
  const count =
    f?.active.filter((l) => l.terms.amount.currency === f.currency).length ?? 0;
  const activeNote =
    count === 1
      ? t("subscriptions.activeOne")
      : t("subscriptions.activeMany", { count: String(count) });
  const monthNote =
    ready && f.leftOut.length > 0
      ? t("subscriptions.leftOut", {
          amounts: f.leftOut
            .map((m) => fmt.money(m, scale(m.currency)))
            .join(", "),
        })
      : activeNote;
  const diff = (value: number) =>
    ready
      ? fmt.signed({ amount: value, currency: f.currency }, scale(f.currency))
      : "";
  const chargedNote =
    f === undefined || f.chargedDiff === 0
      ? t("subscriptions.chargedSame")
      : t(
          f.chargedDiff > 0
            ? "subscriptions.chargedOver"
            : "subscriptions.chargedUnder",
          {
            amount: diff(f.chargedDiff),
          },
        );

  return (
    <SummaryBand
      label={t("subscriptions.figures")}
      loading={loading || !ready}
      figures={[
        {
          key: "month",
          label: t("subscriptions.perMonthFigure"),
          value: amount(f?.monthly ?? 0),
          note: monthNote,
        },
        {
          key: "year",
          label: t("subscriptions.perYearFigure"),
          value: amount(f?.yearly ?? 0),
          note: t("subscriptions.perYearNote"),
        },
        {
          key: "charged",
          label: t("subscriptions.charged"),
          value: amount(f?.charged ?? 0),
          note: chargedNote,
        },
        {
          key: "ended",
          label: t("subscriptions.endedFigure"),
          value: amount(f?.endedMonthly ?? 0),
          note:
            f !== undefined && f.ended.length > 0
              ? t("subscriptions.endedNote")
              : t("subscriptions.noneEnded"),
        },
      ]}
    />
  );
}
