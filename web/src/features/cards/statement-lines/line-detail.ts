import type { components } from "@/api/schema.gen";
import type { MessageKey } from "@/i18n/catalog.en";

type StatementPosting = components["schemas"]["StatementPosting"];
type Translate = (
  key: MessageKey,
  vars?: Record<string, string | number>,
) => string;

export interface LineFlag {
  key: MessageKey;
  tone: "warning" | "info";
}

export interface LineDetail {
  flag: LineFlag | undefined;
  text: string;
}

const roleWords: Record<"credit" | "payment", MessageKey> = {
  credit: "statement.role.credit",
  payment: "statement.role.payment",
};

// The line under a statement line's description on a phone (spec 2026-11-21-mobile-statement,
// MS14): a line the bank has not reported, or else a provisional one, is named first; then the
// role of a credit or a payment (a charge is the normal line) and the installment.
export function lineDetail(
  line: StatementPosting,
  unconfirmed: boolean,
  t: Translate,
): LineDetail {
  const parts = [
    line.card_role === "charge" ? "" : t(roleWords[line.card_role]),
    line.installment === undefined
      ? ""
      : t("statement.installment", {
          number: line.installment.number,
          count: line.installment.count,
        }),
  ].filter((part) => part !== "");

  return { flag: lineFlag(line, unconfirmed), text: parts.join(" · ") };
}

function lineFlag(
  line: StatementPosting,
  unconfirmed: boolean,
): LineFlag | undefined {
  if (unconfirmed) return { key: "statement.unconfirmed", tone: "warning" };

  if (line.provisional) return { key: "statement.provisional", tone: "info" };

  return undefined;
}
