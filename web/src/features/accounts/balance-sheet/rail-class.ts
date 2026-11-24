import styles from "@/features/accounts/balance-sheet/sheet-rail.module.css";
import { cx } from "@/ui/cx";

// The classes of the row of a list on a phone: its level and its place among the children of a
// parent, which the rail draws from.
export function listRailClass(
  child: boolean,
  first: boolean,
  last: boolean,
): string {
  return cx(
    styles.row,
    child ? styles.child : undefined,
    first ? styles.first : undefined,
    last ? styles.last : undefined,
  );
}
