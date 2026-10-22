import { Link } from "@slotted/react/link";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableColumnHeader,
  TableContent,
  TableEmpty,
  TableHead,
  TableLoader,
  TableRow,
  TableRowHeader,
} from "@slotted/react/table";
import { Tag } from "@slotted/react/tag";

import type { components } from "@/api/schema.gen";
import type { MessageKey } from "@/i18n/catalog.en";
import { formatDate } from "@/i18n/format";
import { useAppLocale, useT } from "@/i18n/i18n-provider";
import { useAppLink } from "@/ui/use-app-link";
import { useMoneyFormat } from "@/privacy/use-money-format";

type ExternalRecord = components["schemas"]["ExternalRecord"];

export const recordStateWords: Record<ExternalRecord["state"], MessageKey> = {
  received: "batch.state.received",
  matched: "batch.state.matched",
  created: "batch.state.created",
  needs_review: "batch.state.needs_review",
  discarded: "batch.state.discarded",
  withdrawn: "batch.state.withdrawn",
};

const stateTone = {
  received: "secondary",
  matched: "success",
  created: "accent",
  needs_review: "warning",
  discarded: "secondary",
  withdrawn: "secondary",
} as const;

// The file's lines in file order, each with what became of it and the transaction it feeds.
export function BatchRecordsTable({
  records,
  loading,
  scale,
}: {
  records: ExternalRecord[];
  loading: boolean;
  scale: (code: string) => number;
}) {
  const t = useT();
  const [locale] = useAppLocale();
  const fmt = useMoneyFormat();
  const follow = useAppLink();
  return (
    <Table columns={4} variant="framed">
      <TableContent>
        <TableCaption>{t("batch.lines")}</TableCaption>
        <TableHead>
          <TableRow>
            <TableColumnHeader>{t("scheduled.date")}</TableColumnHeader>
            <TableColumnHeader>{t("ledger.movement")}</TableColumnHeader>
            <TableColumnHeader numeric>{t("ledger.amount")}</TableColumnHeader>
            <TableColumnHeader>{t("batch.state")}</TableColumnHeader>
          </TableRow>
        </TableHead>
        {loading ? (
          <TableLoader skeletonRows={6} />
        ) : (
          <TableBody>
            {records.length === 0 && (
              <TableEmpty>{t("batch.noLines")}</TableEmpty>
            )}
            {records.map((record) => (
              <TableRow key={record.id} value={record.id}>
                <TableRowHeader>
                  {formatDate(record.date, locale)}
                </TableRowHeader>
                <TableCell>
                  {record.transaction_id === undefined ? (
                    record.description
                  ) : (
                    <Link
                      variant="neutral"
                      underline="hover"
                      href={`/transactions/${record.transaction_id}`}
                      onClick={follow({
                        to: "/transactions/$id",
                        params: { id: record.transaction_id },
                      })}
                    >
                      {record.description === ""
                        ? t("ledger.untitled")
                        : record.description}
                    </Link>
                  )}
                </TableCell>
                <TableCell numeric>
                  {fmt.signed(record.amount, scale(record.amount.currency))}
                </TableCell>
                <TableCell>
                  <Tag size="sm" tone={stateTone[record.state]}>
                    {t(recordStateWords[record.state])}
                  </Tag>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        )}
      </TableContent>
    </Table>
  );
}
