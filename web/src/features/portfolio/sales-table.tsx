import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableColumnHeader,
  TableContent,
  TableHead,
  TableLoader,
  TableRow,
} from "@slotted/react/table";
import { Text } from "@slotted/react/typography";

import type { components } from "@/api/schema.gen";
import { AccountLink } from "@/features/accounts";
import { InstrumentName } from "@/ui/instrument-name";
import { useYearNames } from "@/features/portfolio/use-year-names";
import { catalogLabel, useScale } from "@/features/setup";
import { formatDate } from "@/i18n/format";
import { useAppLocale, useT } from "@/i18n/i18n-provider";
import { useMoneyFormat } from "@/privacy/use-money-format";
import { AppLink } from "@/ui/app-link";

type Money = components["schemas"]["Money"];
type Result = components["schemas"]["RealizedResult"];

interface SalesTableProps {
  items: readonly Result[];
  pending: boolean;
}

const columns = 8;

function toneOf(amount: number) {
  if (amount > 0) return "success";

  return amount < 0 ? "danger" : "default";
}

// Every sale of the year at average cost. The class codes come from the user's jurisdiction: a
// class without a catalog key reads as its code, and no class reads as unclassified.
export function SalesTable({ items, pending }: SalesTableProps) {
  const t = useT();
  const [tag] = useAppLocale();
  const fmt = useMoneyFormat();
  const scale = useScale();
  const { holder, instrumentName, pending: naming } = useYearNames();

  const digits = (m: Money) => scale?.(m.currency) ?? 0;

  return (
    <Table columns={columns} variant="framed">
      <TableContent>
        <TableCaption>{t("taxYear.realized.title")}</TableCaption>
        <TableHead>
          <TableRow>
            <TableColumnHeader>{t("taxYear.date")}</TableColumnHeader>
            <TableColumnHeader>{t("taxYear.instrument")}</TableColumnHeader>
            <TableColumnHeader>{t("taxYear.account")}</TableColumnHeader>
            <TableColumnHeader numeric>
              {t("taxYear.quantity")}
            </TableColumnHeader>
            <TableColumnHeader numeric>{t("taxYear.cost")}</TableColumnHeader>
            <TableColumnHeader numeric>
              {t("taxYear.proceeds")}
            </TableColumnHeader>
            <TableColumnHeader numeric>{t("taxYear.result")}</TableColumnHeader>
            <TableColumnHeader>{t("taxYear.taxClass")}</TableColumnHeader>
          </TableRow>
        </TableHead>
        {pending || naming ? (
          <TableLoader skeletonRows={3} />
        ) : (
          <TableBody>
            {items.map((r) => {
              const account = holder(r.account_id);

              return (
                <TableRow
                  key={`${r.transaction_id}-${r.instrument}`}
                  value={`${r.transaction_id}-${r.instrument}`}
                >
                  <TableCell>
                    <AppLink
                      variant="neutral"
                      underline="hover"
                      to={{
                        to: "/transactions/$id",
                        params: { id: r.transaction_id },
                      }}
                    >
                      {formatDate(r.date, tag)}
                    </AppLink>
                  </TableCell>
                  <TableCell>
                    <InstrumentName
                      code={r.instrument}
                      name={instrumentName(r.instrument)}
                    />
                  </TableCell>
                  <TableCell>
                    {account !== undefined && (
                      <AccountLink account={account}>
                        {account.name}
                      </AccountLink>
                    )}
                  </TableCell>
                  <TableCell numeric>
                    {fmt.number(r.quantity, digits(r.quantity))}
                  </TableCell>
                  <TableCell numeric>
                    {fmt.money(r.cost, digits(r.cost))}
                  </TableCell>
                  <TableCell numeric>
                    {fmt.money(r.proceeds, digits(r.proceeds))}
                  </TableCell>
                  <TableCell numeric>
                    <Text size="sm" tone={toneOf(r.result.amount)}>
                      {fmt.signed(r.result, digits(r.result))}
                    </Text>
                  </TableCell>
                  <TableCell>
                    {r.tax_class === null
                      ? t("taxYear.unclassified")
                      : catalogLabel(
                          t,
                          `taxYear.class.${r.tax_class}`,
                          r.tax_class,
                        )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        )}
      </TableContent>
    </Table>
  );
}
