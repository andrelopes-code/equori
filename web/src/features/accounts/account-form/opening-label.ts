import type { Kind } from "@/features/accounts/model/account-kinds";

// The label of the opening balance: a card owes on its open statement, a debt owes, a brokerage
// holds cash, an asset holds a balance.
export function openingLabel(kind: Kind, cls: "asset" | "liability") {
  if (kind === "credit_card") return "accountForm.openingCard";

  if (kind === "brokerage") return "accountForm.cashOpening";

  if (cls === "liability") return "accountForm.openingOwed";

  return "accountForm.opening";
}
