import type { components } from "@/api/schema.gen";
import { changeOf } from "@/features/assistant/proposal/preview-field";
import { formatDate, formatDayMonthNumeric } from "@/i18n/format";
import type { MessageKey } from "@/i18n/catalog.en";

type Preview = components["schemas"]["AssistantPreview"];

export interface Counted {
  key: MessageKey;
  count: number;
}

// F8: an operation that writes from a file: the file, where it goes, what it holds.
export interface FileOp {
  name: string;
  // The account or the transaction the file goes to, or the instruments it prices.
  target: string | Counted | undefined;
  // The day of the transaction a file is attached to.
  day: string | undefined;
  lines: Counted | undefined;
  from: string | undefined;
  until: string | undefined;
}

export function fileOp(preview: Preview): FileOp {
  const text = (field: string) => changeOf(preview, field)?.after?.text;
  const date = (field: string) => changeOf(preview, field)?.after?.date;
  const counted = (
    field: string,
    one: MessageKey,
    other: MessageKey,
  ): Counted | undefined => {
    const value = text(field);
    if (value === undefined) return undefined;

    const count = Number(value);
    return { key: count === 1 ? one : other, count };
  };

  const op = {
    name: text("source") ?? "",
    target: undefined,
    day: undefined,
    lines: undefined,
    from: date("from"),
    until: date("until"),
  };

  switch (preview.action) {
    case "import_statement_file":
      return {
        ...op,
        target: text("account"),
        lines: counted(
          "count",
          "assistant.body.lines.one",
          "assistant.body.lines.other",
        ),
      };
    case "import_price_file":
      return {
        ...op,
        target: counted(
          "instruments",
          "assistant.body.instruments.one",
          "assistant.body.instruments.other",
        ),
        lines: counted(
          "count",
          "assistant.body.prices.one",
          "assistant.body.prices.other",
        ),
      };
    default:
      return { ...op, target: text("transaction"), day: date("date") };
  }
}

// The ends of the period of a file in the locale's format; the first end drops its year when both
// fall in one year ("01/10" to "31/10/2026").
export function filePeriod(
  op: FileOp,
  locale: string,
): { from: string; until: string } | null {
  if (op.from === undefined || op.until === undefined) return null;

  const sameYear = op.from.slice(0, 4) === op.until.slice(0, 4);

  return {
    from: sameYear
      ? formatDayMonthNumeric(op.from, locale)
      : formatDate(op.from, locale),
    until: formatDate(op.until, locale),
  };
}
