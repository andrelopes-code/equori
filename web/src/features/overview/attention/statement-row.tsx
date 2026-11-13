import { Text } from "@slotted/react/typography";

import type { StatementItem } from "@/features/overview/attention/attention";
import { itemDestination } from "@/features/overview/attention/attention-destination";
import { AttentionRow } from "@/features/overview/attention/attention-row";
import { useBase } from "@/features/overview/model/use-base";
import { formatDate } from "@/i18n/format";
import { useAppLocale, useT } from "@/i18n/i18n-provider";
import type { TFunction } from "@/i18n/i18n-provider";
import { MoneyFigure } from "@/ui/money/money-figure";

// A statement due within the notice days: the due date in the warning tone, the amount at the end.
export function StatementRow({ item }: { item: StatementItem }) {
  const t = useT();
  const [locale] = useAppLocale();
  const { scale } = useBase();
  const { unpaid, due_date } = item.statement;
  const date = formatDate(due_date, locale);

  return (
    <AttentionRow
      title={t("overview.attention.statementOf", {
        account: item.account.name,
      })}
      to={itemDestination(item, "")}
      line={
        <Text size="sm" tone="warning" weight="medium">
          {dueText(item.days, date, t)}
        </Text>
      }
      end={
        <Text tone="default" weight="semibold" numeric="tabular">
          <MoneyFigure
            amount={unpaid.amount}
            currency={unpaid.currency}
            scale={scale === null ? 0 : scale(unpaid.currency)}
          />
        </Text>
      }
    />
  );
}

function dueText(days: number, date: string, t: TFunction): string {
  if (days === 0) return t("overview.attention.dueToday", { date });
  if (days === 1) return t("overview.attention.dueInOne", { date });

  return t("overview.attention.dueIn", { count: days, date });
}
