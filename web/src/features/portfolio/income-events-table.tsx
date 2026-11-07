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

import type { components } from "@/api/schema.gen";
import { AccountLink } from "@/features/accounts";
import { InstrumentName } from "@/features/portfolio/instrument-name";
import { useYearNames } from "@/features/portfolio/use-year-names";
import { catalogLabel, useScale } from "@/features/setup";
import { formatDate } from "@/i18n/format";
import { useAppLocale, useT } from "@/i18n/i18n-provider";
import { useMoneyFormat } from "@/privacy/use-money-format";
import { AppLink } from "@/ui/app-link";

type Event = components["schemas"]["IncomeEvent"];
type Money = components["schemas"]["Money"];

interface IncomeEventsTableProps {
  items: readonly Event[];
  pending: boolean;
}

const columns = 8;

const net = (e: Event): Money => ({
  amount: e.gross.amount - e.withheld.amount,
  currency: e.gross.currency,
});

// Every payment of the year. The contract has no net amount, so it is the gross less the withheld.
export function IncomeEventsTable({ items, pending }: IncomeEventsTableProps) {
  const t = useT();
  const [tag] = useAppLocale();
  const fmt = useMoneyFormat();
  const scale = useScale();
  const { holder, instrumentName, pending: naming } = useYearNames();

  const money = (m: Money) => fmt.money(m, scale?.(m.currency) ?? 0);

  return (
    <Table columns={columns} variant="framed">
      <TableContent>
        <TableCaption>{t("taxYear.income.title")}</TableCaption>
        <TableHead>
          <TableRow>
            <TableColumnHeader>{t("taxYear.date")}</TableColumnHeader>
            <TableColumnHeader>{t("taxYear.instrument")}</TableColumnHeader>
            <TableColumnHeader>{t("taxYear.account")}</TableColumnHeader>
            <TableColumnHeader>{t("taxYear.incomeType")}</TableColumnHeader>
            <TableColumnHeader>{t("taxYear.taxTreatment")}</TableColumnHeader>
            <TableColumnHeader numeric>{t("taxYear.gross")}</TableColumnHeader>
            <TableColumnHeader numeric>
              {t("taxYear.withheld")}
            </TableColumnHeader>
            <TableColumnHeader numeric>{t("taxYear.net")}</TableColumnHeader>
          </TableRow>
        </TableHead>
        {pending || naming ? (
          <TableLoader skeletonRows={3} />
        ) : (
          <TableBody>
            {items.map((e) => {
              const account = holder(e.account_id);

              return (
                <TableRow
                  key={`${e.transaction_id}-${e.instrument}`}
                  value={`${e.transaction_id}-${e.instrument}`}
                >
                  <TableCell>
                    <AppLink
                      variant="neutral"
                      underline="hover"
                      to={{
                        to: "/transactions/$id",
                        params: { id: e.transaction_id },
                      }}
                    >
                      {formatDate(e.date, tag)}
                    </AppLink>
                  </TableCell>
                  <TableCell>
                    <InstrumentName
                      code={e.instrument}
                      name={instrumentName(e.instrument)}
                    />
                  </TableCell>
                  <TableCell>
                    {account !== undefined && (
                      <AccountLink account={account}>
                        {account.name}
                      </AccountLink>
                    )}
                  </TableCell>
                  <TableCell>
                    {catalogLabel(
                      t,
                      `income.type.${e.income_type}`,
                      e.income_type,
                    )}
                  </TableCell>
                  <TableCell>
                    {e.tax_treatment === null
                      ? t("taxYear.unclassified")
                      : catalogLabel(
                          t,
                          `taxYear.treatment.${e.tax_treatment}`,
                          e.tax_treatment,
                        )}
                  </TableCell>
                  <TableCell numeric>{money(e.gross)}</TableCell>
                  <TableCell numeric>{money(e.withheld)}</TableCell>
                  <TableCell numeric>{money(net(e))}</TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        )}
      </TableContent>
    </Table>
  );
}
