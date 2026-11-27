import type {
  GroupBy,
  Order,
} from "@/features/accounts/balance-sheet/sheet-layout";

export type Basis = "booked" | "settled";

// The view the balance sheet is read in: the day, the basis, the closed accounts, the grouping
// and the order of the list.
export interface SheetBarProps {
  date: string;
  basis: Basis;
  closed: boolean;
  group: GroupBy;
  order: Order;
  onDateChange: (date: string) => void;
  onBasisChange: (basis: Basis) => void;
  onClosedChange: (closed: boolean) => void;
  onGroupChange: (group: GroupBy) => void;
  onOrderChange: (order: Order) => void;
}
