import type { components } from "@/api/schema.gen";
import type { TFunction } from "@/i18n/i18n-provider";

type Money = components["schemas"]["Money"];
type Report = Pick<
  components["schemas"]["IssuerExposureReport"],
  "issuers" | "guarantee"
>;

interface VerdictEvent {
  date: string;
  kind: string;
  state: string;
  gross?: Money;
}

export interface VerdictFormat {
  money: (m: Money) => string;
  // Day and month of an ISO date.
  day: (iso: string) => string;
}

export interface Verdict {
  tone: "danger" | "neutral";
  line: string;
  detail: string;
}

// The first line of the panel: an exceeded guarantee, else the payments to record, else the next
// maturity; the detail holds the facts the line does not (FC36, approved mock).
export function fixedIncomeVerdict(
  report: Report,
  events: readonly VerdictEvent[],
  t: TFunction,
  fmt: VerdictFormat,
): Verdict | null {
  const worst = largestExcess(report);
  const due = events.filter((e) => e.state === "due").length;
  const maturity = events
    .filter(
      (e) =>
        e.kind === "maturity" &&
        e.state === "upcoming" &&
        e.gross !== undefined,
    )
    .sort((a, b) => a.date.localeCompare(b.date))[0];
  const dueText =
    due === 1
      ? t("fixedIncome.verdict.dueOne")
      : t("fixedIncome.verdict.due", { count: due });
  const maturityText =
    maturity?.gross === undefined
      ? ""
      : t("fixedIncome.verdict.matures", {
          date: fmt.day(maturity.date),
          amount: fmt.money(maturity.gross),
        });

  if (worst !== null && report.guarantee !== undefined) {
    const line = t("fixedIncome.verdict.excess", {
      amount: fmt.money(worst.amount),
      guarantee: report.guarantee.name,
      issuer: worst.issuer,
    });

    return {
      tone: "danger",
      line,
      detail: joined(due > 0 ? dueText : "", maturityText),
    };
  }

  if (due > 0) return { tone: "danger", line: dueText, detail: maturityText };

  if (maturity?.gross === undefined) return null;

  return {
    tone: "neutral",
    line: t("fixedIncome.verdict.next", {
      date: fmt.day(maturity.date),
      amount: fmt.money(maturity.gross),
    }),
    detail: "",
  };
}

function largestExcess(
  report: Report,
): { issuer: string; amount: Money } | null {
  let worst: { issuer: string; amount: Money } | null = null;
  for (const i of report.issuers) {
    if (i.excess === undefined || i.excess.amount <= 0) continue;
    if (worst === null || i.excess.amount > worst.amount.amount)
      worst = { issuer: i.issuer ?? "", amount: i.excess };
  }

  return worst;
}

function joined(...parts: string[]): string {
  return parts.filter((p) => p !== "").join(" · ");
}
