import type { components } from "@/api/schema.gen";

type Investment = components["schemas"]["ExternalInvestment"];
type Movement = components["schemas"]["InvestmentMovement"];

export interface InvestmentGroup {
  id: string;
  name: string;
  movements: Movement[];
  // MB1: pending application, contribution and sale, by date. Incomes stay one by one.
  batch: Movement[];
}

const batchProposals = new Set(["application", "contribution", "sale"]);

// The investments with movements, by name, each with its movements by date.
export function investmentGroups(investments: Investment[]): InvestmentGroup[] {
  return investments
    .filter((i) => i.movements.length > 0)
    .map((i) => {
      const movements = [...i.movements].sort((a, b) =>
        a.date.localeCompare(b.date),
      );
      const batch = movements.filter(
        (m) => m.state === "pending" && batchProposals.has(m.proposal),
      );
      return { id: i.id, name: i.name, movements, batch };
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}
