import type { components } from "@/api/schema.gen";

type Account = components["schemas"]["Account"];

export type RecordShape = "property" | "loan" | "cash";

// The form a page and a list line take for an account. A loan is a debt only on the liability
// side; a loan the owner lent is an asset and keeps the cash form.
export function recordShape(account: Account): RecordShape {
  if (account.kind === "property") return "property";
  if (account.kind === "loan" && account.class === "liability") return "loan";

  return "cash";
}
