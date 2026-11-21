import type { components } from "@/api/schema.gen";
import type { MessageKey } from "@/i18n/catalog.en";
import { formatDate, formatReferenceMonth } from "@/i18n/format";

type Posting = components["schemas"]["Posting"];

type Translate = (
  key: MessageKey,
  values?: Record<string, string | number>,
) => string;

// The line under an account of the phone receipt: the statement month, the installment, the
// clearing date and the note, in that order (spec 2026-11-21-mobile-transaction-detail, MD5).
export function postingDetail(
  posting: Posting,
  t: Translate,
  locale: string,
): string {
  const parts = [
    posting.statement === undefined
      ? ""
      : t("postings.statement", {
          month: formatReferenceMonth(posting.statement, locale),
        }),
    posting.installment === undefined
      ? ""
      : t("postings.installment", {
          number: posting.installment.number,
          count: posting.installment.count,
        }),
    posting.settled_on === undefined
      ? ""
      : formatDate(posting.settled_on, locale),
    posting.memo ?? "",
  ];

  return parts.filter((part) => part !== "").join(" · ");
}
