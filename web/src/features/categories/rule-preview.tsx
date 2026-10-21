import { InlineMessage } from "@slotted/react/inline-message";
import { Stack } from "@slotted/react/stack";
import { Heading, Text } from "@slotted/react/typography";
import { useQuery } from "@tanstack/react-query";

import { useApi } from "@/api/api-context";
import { ProblemError, unwrap } from "@/api/problem";
import type { components } from "@/api/schema.gen";
import { rulePreview } from "@/features/categories/api";
import styles from "@/features/categories/rule-preview.module.css";
import { PreviewList } from "@/features/categories/preview-list";
import { useT } from "@/i18n/i18n-provider";
import { useDebounced } from "@/ui/use-debounced";

type RuleInput = components["schemas"]["RuleInput"];

// A81: what the rule would do alone over the last 365 days, read again as the draft settles.
export function RulePreview({ rule }: { rule: RuleInput | null }) {
  const t = useT();
  const api = useApi();
  // A81 reads a year of transactions; the request waits for the typing to stop.
  const settled = useDebounced(JSON.stringify(rule), 400);
  const preview = useQuery({
    queryKey: ["rules", "preview", settled] as const,
    queryFn: async () => {
      const body = JSON.parse(settled) as RuleInput | null;
      if (body === null) return null;
      return unwrap(await rulePreview(api, body));
    },
    enabled: settled !== "null",
    placeholderData: (previous) => previous,
    staleTime: 30_000,
    retry: false,
  });
  return (
    <section className={styles.panel} aria-busy={preview.isFetching}>
      <Stack gap={4}>
        <Stack gap={1}>
          <Heading level={2} size="md">
            {t("preview.title")}
          </Heading>
          <Text size="sm" tone="muted">
            {t("preview.hint")}
          </Text>
        </Stack>
        {rule === null && <Text tone="muted">{t("preview.waiting")}</Text>}
        {rule !== null && preview.isError && (
          <InlineMessage tone="danger">
            {preview.error instanceof ProblemError
              ? (preview.error.problem.errors?.[0]?.message ??
                t("preview.failed"))
              : t("preview.failed")}
          </InlineMessage>
        )}
        {rule !== null && preview.data != null && (
          <>
            {preview.data.would_categorize.count === 0 &&
              preview.data.conflicts.count === 0 && (
                <Text tone="muted">{t("preview.none")}</Text>
              )}
            {preview.data.would_categorize.count > 0 && (
              <PreviewList
                title={t("preview.would", {
                  count: preview.data.would_categorize.count,
                })}
                set={preview.data.would_categorize}
              />
            )}
            {preview.data.conflicts.count > 0 && (
              <PreviewList
                title={t("preview.conflicts", {
                  count: preview.data.conflicts.count,
                })}
                set={preview.data.conflicts}
              />
            )}
          </>
        )}
      </Stack>
    </section>
  );
}
