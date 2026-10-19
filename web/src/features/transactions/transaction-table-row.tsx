import { Link } from "@slotted/react/link";
import type { MouseEvent } from "react";

import { TransactionTableCategory } from "@/features/transactions/transaction-table-category";
import styles from "@/features/transactions/transaction-table.module.css";
import type { TransactionRow } from "@/features/transactions/transaction-row";
import { useT } from "@/i18n/i18n-provider";
import { useSpaLink } from "@/ui/use-spa-link";

const separator = " · ";

// A booked row. With onSelect the whole row selects on a click; the description link stays
// the keyboard target and the route to the transaction page for a modified click.
export function TransactionTableRow({
  row,
  amount,
  brief,
  selected,
  onSelect,
}: {
  row: TransactionRow;
  amount: string;
  brief: boolean;
  selected: boolean;
  onSelect: ((id: string) => void) | undefined;
}) {
  const t = useT();
  const spaLink = useSpaLink();
  const select =
    onSelect === undefined
      ? undefined
      : (event: MouseEvent) => {
          if (event.metaKey || event.ctrlKey || event.shiftKey) return;
          event.preventDefault();
          onSelect(row.id);
        };
  return (
    <tr
      className={styles.row}
      data-selectable={select === undefined ? undefined : "true"}
      data-selected={selected ? "true" : undefined}
      onClick={
        select === undefined
          ? undefined
          : (event) => {
              if (event.target instanceof Element && event.target.closest("a"))
                return;
              select(event);
            }
      }
    >
      <td>
        <span className={row.voided ? styles.voided : undefined}>
          <Link
            {...spaLink(`/transactions/${row.id}`)}
            {...(select === undefined
              ? {}
              : {
                  onClick: select,
                  "aria-current": selected ? ("true" as const) : undefined,
                })}
            variant="neutral"
            underline={selected ? "always" : "hover"}
          >
            {row.title === "" ? t("transactions.untitled") : row.title}
          </Link>
          {row.tags.map((tag) => (
            <span key={tag} className={styles.muted}>
              {separator + tag}
            </span>
          ))}
        </span>
      </td>
      <td className={styles.clipMuted}>{row.accounts}</td>
      {!brief && (
        <td className={styles.clip}>
          <TransactionTableCategory row={row} />
        </td>
      )}
      <td data-numeric="">{amount}</td>
    </tr>
  );
}
