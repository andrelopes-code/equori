import type { ViewMoney } from "@/features/assistant/view/view-types";

export interface TreemapData {
  total: ViewMoney;
  cells: {
    account_id?: string;
    name: string;
    amount: ViewMoney;
    share_bp: number;
    rest: boolean;
    count?: number;
    x: number;
    y: number;
    w: number;
    h: number;
  }[];
}

export type CellLabel = "full" | "share" | "none";

// What a cell has room for: name, value and share; the share alone; or nothing (the tooltip holds it).
// The box is 176 px tall and the view's body 278 px wide or more: 26% by 25% fits three lines and
// 13% by 14% fits a share of three digits beside the cell's edge and padding.
export function cellLabel(w: number, h: number): CellLabel {
  if (w >= 26 && h >= 25) return "full";
  if (w >= 13 && h >= 14) return "share";

  return "none";
}
