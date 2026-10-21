import { Stack } from "@slotted/react/stack";
import { Text } from "@slotted/react/typography";
import { useQueries } from "@tanstack/react-query";

import { useApi } from "@/api/api-context";
import { unwrap } from "@/api/problem";
import type { components } from "@/api/schema.gen";
import styles from "@/features/categories/rule-preview.module.css";
import { formatDate } from "@/i18n/format";
import { useAppLocale, useT } from "@/i18n/i18n-provider";

type PreviewSet = components["schemas"]["RulePreviewSet"];

const shown = 8;

// The first transactions of a preview set, by description and date.
export function PreviewList({
  title,
  set,
}: {
  title: string;
  set: PreviewSet;
}) {
  const t = useT();
  const [locale] = useAppLocale();
  const api = useApi();
  const ids = set.transaction_ids.slice(0, shown);
  const rows = useQueries({
    queries: ids.map((id) => ({
      queryKey: ["transactions", "detail", id] as const,
      queryFn: async () =>
        unwrap(
          await api.GET("/transactions/{id}", { params: { path: { id } } }),
        ),
    })),
  });
  return (
    <Stack gap={2}>
      <Text weight="semibold">{title}</Text>
      <ul className={styles.list}>
        {rows.map((row, i) => (
          <li key={ids[i]} className={styles.item}>
            <Text className={styles.cut}>
              {row.data === undefined
                ? t("links.loading")
                : row.data.description || t("transactions.untitled")}
            </Text>
            <Text tone="muted" numeric="tabular">
              {row.data === undefined ? "" : formatDate(row.data.date, locale)}
            </Text>
          </li>
        ))}
      </ul>
      {set.count > ids.length && (
        <Text size="sm" tone="muted">
          {t("preview.more", { count: set.count - ids.length })}
        </Text>
      )}
    </Stack>
  );
}
