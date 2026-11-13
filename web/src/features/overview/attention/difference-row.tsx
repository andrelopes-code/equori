import { Text } from "@slotted/react/typography";

import type { DifferenceItem } from "@/features/overview/attention/attention";
import { itemDestination } from "@/features/overview/attention/attention-destination";
import { AttentionRow } from "@/features/overview/attention/attention-row";
import { useBase } from "@/features/overview/model/use-base";
import { numberFormatter } from "@/i18n/format";
import { useAppLocale, useT } from "@/i18n/i18n-provider";
import { MoneyFigure } from "@/ui/money/money-figure";

export function DifferenceRow({ item }: { item: DifferenceItem }) {
  const t = useT();
  const [locale] = useAppLocale();
  const { scale } = useBase();
  const { difference, account, unconfirmed } = item;

  return (
    <AttentionRow
      title={t("overview.attention.difference")}
      to={itemDestination(item, "")}
      line={
        <Text size="sm" tone="muted">
          {unconfirmed === undefined
            ? account.name
            : t("overview.attention.withUnconfirmed", {
                account: account.name,
                count: numberFormatter(locale).format(unconfirmed),
              })}
        </Text>
      }
      end={
        <Text tone="default" weight="semibold" numeric="tabular">
          <MoneyFigure
            amount={difference.amount}
            currency={difference.currency}
            scale={scale === null ? 0 : scale(difference.currency)}
          />
        </Text>
      }
    />
  );
}
