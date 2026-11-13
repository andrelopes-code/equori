import type { components } from "@/api/schema.gen";

type Money = components["schemas"]["Money"];

// One group as the composition editor draws it. Shares are basis points of the portfolio.
export interface CompositionGroup {
  key: string;
  name: string;
  // The position of the group in the plan; it picks the colour of the data palette.
  colour: number;
  targetBp: number;
  todayBp?: number;
  locked: boolean;
  // Present only for a group that receives money.
  amount?: Money;
}
