import { Skeleton } from "@slotted/react/skeleton";
import { Stack } from "@slotted/react/stack";
import {
  Table,
  TableBody,
  TableCell,
  TableColumnHeader,
  TableContent,
  TableHead,
  TableRow,
  TableRowHeader,
} from "@slotted/react/table";

import styles from "@/features/accounts/balance-sheet/balance-sheet.module.css";
import { railClass } from "@/features/accounts/balance-sheet/rail-class";
import rail from "@/features/accounts/balance-sheet/sheet-rail.module.css";
import { useT } from "@/i18n/i18n-provider";

// The widths of the name, the caption, the status and the balance of each reserved row.
const rows = [
  { name: "9rem", caption: "6rem", status: "8rem", balance: "6rem" },
  { name: "7rem", caption: "8rem", status: "6rem", balance: "5rem" },
  { name: "11rem", caption: "5rem", status: "9rem", balance: "7rem" },
  { name: "8rem", caption: "7rem", status: "6rem", balance: "5rem" },
];

// The accounts table while the balances load, in the cells of sheet-account-row.tsx: the mark, the
// name over its caption, the reconciliation and the balance. The groups are not known yet, so one
// table stands for them.
export function SheetGroupsPlaceholder() {
  const t = useT();

  return (
    <Table columns={3} variant="framed" aria-busy="true">
      <TableContent
        aria-label={t("balanceSheet.account")}
        className={styles.fixed}
      >
        <TableHead>
          <TableRow>
            <TableColumnHeader>{t("balanceSheet.account")}</TableColumnHeader>
            <TableColumnHeader className={styles.statusColumn}>
              {t("balanceSheet.status")}
            </TableColumnHeader>
            <TableColumnHeader numeric className={styles.balanceColumn}>
              {t("balanceSheet.balance")}
            </TableColumnHeader>
          </TableRow>
        </TableHead>

        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.name} value={row.name}>
              <TableRowHeader className={railClass(false, false, false)}>
                <div className={rail.account}>
                  <span className={rail.slot} aria-hidden="true" />
                  <Skeleton shape="square" size="md" />
                  <Stack gap={3}>
                    <Skeleton
                      shape="block"
                      inlineSize={row.name}
                      blockSize={12}
                    />
                    <Skeleton
                      shape="block"
                      inlineSize={row.caption}
                      blockSize={10}
                    />
                  </Stack>
                </div>
              </TableRowHeader>

              <TableCell>
                <Skeleton shape="text" inlineSize={row.status} />
              </TableCell>

              <TableCell numeric>
                <Skeleton shape="text" inlineSize={row.balance} />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </TableContent>
    </Table>
  );
}
