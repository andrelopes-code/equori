import type { Deadline } from "@/features/overview/cards/wallet";
import { formatDayMonthNumeric, formatRelativeDays } from "@/i18n/format";
import type { TFunction } from "@/i18n/i18n-provider";

// The words of a statement's deadline (CW8).
export function deadlineWords(
  deadline: Deadline,
  locale: string,
  t: TFunction,
): string {
  if (deadline.kind === "date") {
    return t("overview.cards.dueOn", {
      date: formatDayMonthNumeric(deadline.date, locale),
    });
  }

  const when = formatRelativeDays(deadline.days, locale);

  return deadline.kind === "overdue"
    ? t("overview.cards.overdue", { when })
    : t("overview.cards.dueWhen", { when });
}

// The tone of those words: danger past the date, warning within three days, muted after.
export function deadlineTone(
  deadline: Deadline,
): "danger" | "warning" | "muted" {
  if (deadline.kind === "overdue") return "danger";

  return deadline.kind === "soon" ? "warning" : "muted";
}
