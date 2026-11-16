import { Text } from "@slotted/react/typography";

import { recordSearch } from "@/features/instruments";
import type { FixedIncomeDueItem } from "@/features/overview/attention/attention";
import { AttentionRow } from "@/features/overview/attention/attention-row";
import { useBase } from "@/features/overview/model/use-base";
import { formatDate } from "@/i18n/format";
import { useAppLocale, useT } from "@/i18n/i18n-provider";
import { MoneyFigure } from "@/ui/money/money-figure";

// A payment of fixed income past its date and not yet recorded; the row opens the matching form.
export function FixedIncomeDueRow({ item }: { item: FixedIncomeDueItem }) {
  const t = useT();
  const [locale] = useAppLocale();
  const { scale } = useBase();
  const { event } = item;
  const { gross } = event;
  const line = `${formatDate(event.date, locale)} · ${t("overview.attention.record")}`;

  return (
    <AttentionRow
      title={t(
        `overview.attention.fixedIncomeDue.${event.kind}` as "overview.attention.fixedIncomeDue.interest",
        {
          instrument: event.instrument,
        },
      )}
      to={
        scale === null
          ? undefined
          : {
              to: "/transactions/new",
              search: recordSearch(event, scale) as never,
            }
      }
      line={
        <Text size="sm" tone="muted">
          {line}
        </Text>
      }
      end={
        gross !== undefined && (
          <Text tone="default" weight="semibold" numeric="tabular">
            <MoneyFigure
              amount={gross.amount}
              currency={gross.currency}
              scale={scale === null ? 0 : scale(gross.currency)}
            />
          </Text>
        )
      }
    />
  );
}
