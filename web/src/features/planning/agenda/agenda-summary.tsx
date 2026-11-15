import type { MonthClose } from "@/features/planning/agenda/month-close";
import { SummaryBand } from "@/features/planning/summary/summary-band";
import { formatBasisPoints, formatMonthInSentence } from "@/i18n/format";
import { useAppLocale, useT } from "@/i18n/i18n-provider";
import { useMoneyFormat } from "@/privacy/use-money-format";

interface AgendaSummaryProps {
  month: string;
  close: MonthClose | undefined;
  scale: ((code: string) => number) | null;
  loading: boolean;
}

// The agenda's band: how the month closes, what comes in and goes out, and what is still to
// pay (spec A1).
export function AgendaSummary({
  month,
  close,
  scale,
  loading,
}: AgendaSummaryProps) {
  const t = useT();
  const [locale] = useAppLocale();
  const fmt = useMoneyFormat();

  const ready = close !== undefined && scale !== null;
  const amount = (value: number, signed = false) =>
    ready
      ? {
          money: { amount: value, currency: close.currency },
          scale: scale(close.currency),
          signed,
        }
      : undefined;
  const share = (part: number, total: number) =>
    formatBasisPoints(
      total === 0 ? 0 : Math.round((part * 10000) / total),
      locale,
    );
  const leftOut =
    ready && close.leftOut.length > 0
      ? t("agenda.leftOut", {
          amounts: close.leftOut
            .map((m) => fmt.signed(m, scale(m.currency)))
            .join(", "),
        })
      : t("agenda.closeNote");

  return (
    <SummaryBand
      label={t("agenda.figures")}
      loading={loading || !ready}
      figures={[
        {
          key: "close",
          label: t("agenda.close", {
            month: formatMonthInSentence(month, locale),
          }),
          value: amount(close?.close ?? 0, true),
          note: leftOut,
        },
        {
          key: "inflows",
          label: t("agenda.inflows"),
          value: amount(close?.inflow ?? 0),
          meter: {
            value: close?.inflowDone ?? 0,
            max: close?.inflow ?? 0,
            label: t("agenda.inflows"),
          },
          note: t("agenda.received", {
            percent: share(close?.inflowDone ?? 0, close?.inflow ?? 0),
          }),
        },
        {
          key: "outflows",
          label: t("agenda.outflows"),
          value: amount(close?.outflow ?? 0),
          meter: {
            value: close?.outflowDone ?? 0,
            max: close?.outflow ?? 0,
            label: t("agenda.outflows"),
          },
          note: t("agenda.paid", {
            percent: share(close?.outflowDone ?? 0, close?.outflow ?? 0),
          }),
        },
        {
          key: "to-pay",
          label: t("agenda.toPay"),
          value: amount(close?.toPay ?? 0),
          note:
            close?.pendingCount === 1
              ? t("agenda.pendingOne")
              : t("agenda.pendingMany", {
                  count: String(close?.pendingCount ?? 0),
                }),
        },
      ]}
    />
  );
}
