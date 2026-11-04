import type { components } from "@/api/schema.gen";
import { formatFileSize } from "@/features/transactions";
import type { TFunction } from "@/i18n/i18n-provider";

type Export = components["schemas"]["Export"];

// The sentence under the export row: none requested, preparing, failed or ready.
export function exportStatus(
  current: Export | null | undefined,
  t: TFunction,
  tag: string,
): string {
  if (current === null || current === undefined) return t("export.none");
  switch (current.status) {
    case "pending":
      return t("export.pending");
    case "failed":
      return t("export.failed");
    case "ready":
      return t("export.ready", {
        size: formatFileSize(current.size ?? 0, tag),
        date: new Intl.DateTimeFormat(tag, { dateStyle: "medium" }).format(
          new Date(current.requested_at),
        ),
        version: current.archive_version ?? 1,
      });
  }
}
