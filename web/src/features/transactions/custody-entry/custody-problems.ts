import type { components } from "@/api/schema.gen";
import type { CustodyDraft } from "@/features/transactions/custody-entry/custody-draft";
import type { TFunction } from "@/i18n/i18n-provider";

type Account = components["schemas"]["Account"];

interface Resolved {
  brokerage: Account | undefined;
  // The holding that gives: the brokerage's account of the chosen investment.
  holding: Account | undefined;
}

// The fields of a transfer that the form refuses before the server does.
export function custodyProblems(
  draft: CustodyDraft,
  { brokerage, holding }: Resolved,
  t: TFunction,
): Record<string, string> {
  const problems: Record<string, string> = {};

  if (brokerage === undefined) {
    problems.brokerage_id = t("entry.required.account");
  }
  if (holding === undefined) {
    problems.instrument = t("trade.required.securityAccount");
  }
  if (draft.toId === null) problems.to = t("custody.required.to");
  if (draft.quantity <= 0) problems.quantity = t("custody.required.quantity");

  return problems;
}
