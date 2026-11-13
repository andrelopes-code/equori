import { Text } from "@slotted/react/typography";

import { AttentionRow } from "@/features/overview/attention/attention-row";
import { useAppLocale, useT } from "@/i18n/i18n-provider";
import { numberFormatter } from "@/i18n/format";

export function ConnectionsRow({ count }: { count: number }) {
  const t = useT();
  const [locale] = useAppLocale();

  return (
    <AttentionRow
      title={t("overview.attention.connections")}
      to={{ to: "/accounts/links" }}
      end={
        <Text tone="default" weight="semibold" numeric="tabular">
          {numberFormatter(locale).format(count)}
        </Text>
      }
    />
  );
}
