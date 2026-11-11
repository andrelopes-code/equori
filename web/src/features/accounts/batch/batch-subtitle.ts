import type { components } from "@/api/schema.gen";
import { formatDate } from "@/i18n/format";
import type { TFunction } from "@/i18n/i18n-provider";

type ImportBatch = components["schemas"]["ImportBatch"];

export function batchSubtitle(
  batch: ImportBatch,
  accountName: string | undefined,
  locale: string,
  t: TFunction,
): string {
  return [
    accountName,
    batch.period_from === undefined || batch.period_to === undefined
      ? undefined
      : t("imports.range", {
          from: formatDate(batch.period_from, locale),
          to: formatDate(batch.period_to, locale),
        }),
    t("batch.importedOn", {
      date: formatDate(batch.started_at.slice(0, 10), locale),
    }),
  ]
    .filter((part) => part !== undefined)
    .join(" · ");
}
