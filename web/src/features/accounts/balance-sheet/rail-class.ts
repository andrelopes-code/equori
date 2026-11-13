import styles from "@/features/accounts/balance-sheet/sheet-rail.module.css";

// The classes of the cell that holds the name of a row: its level and its place among the
// children of a parent, which the rail draws from.
export function railClass(
  child: boolean,
  first: boolean,
  last: boolean,
): string {
  return [
    styles.cell,
    child ? styles.child : undefined,
    first ? styles.first : undefined,
    last ? styles.last : undefined,
  ]
    .filter((name) => name !== undefined)
    .join(" ");
}
