import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableColumnHeader,
  TableContent,
  TableHead,
  TableRow,
} from "@slotted/react/table";
import { Tag } from "@slotted/react/tag";

import type { components } from "@/api/schema.gen";
import type { CategoryEntry } from "@/features/categories";
import type { MessageKey } from "@/i18n/catalog.en";
import { formatDate, formatMoney, formatReferenceMonth } from "@/i18n/format";
import { useAppLocale, useT } from "@/i18n/i18n-provider";

type Account = components["schemas"]["Account"];
type Posting = components["schemas"]["Posting"];

const statusWords: Record<NonNullable<Posting["status"]>, MessageKey> = {
  pending: "posting.status.pending",
  cleared: "posting.status.cleared",
  reconciled: "posting.status.reconciled",
};

const statusTone = {
  pending: "warning",
  cleared: "secondary",
  reconciled: "success",
} as const;

// A transaction holds a handful of postings: a bounded set, so a table (LP-14).
export function PostingsTable({
  postings,
  accounts,
  categories,
  scale,
}: {
  postings: readonly Posting[];
  accounts: Map<string, Account>;
  categories: Map<string, CategoryEntry>;
  scale: (code: string) => number;
}) {
  const t = useT();
  const [locale] = useAppLocale();
  return (
    <Table columns={5} variant="framed">
      <TableContent>
        <TableCaption>{t("postings.caption")}</TableCaption>
        <TableHead>
          <TableRow>
            <TableColumnHeader>{t("postings.account")}</TableColumnHeader>
            <TableColumnHeader numeric>
              {t("postings.amount")}
            </TableColumnHeader>
            <TableColumnHeader>{t("postings.status")}</TableColumnHeader>
            <TableColumnHeader>{t("postings.settled")}</TableColumnHeader>
            <TableColumnHeader>{t("postings.memo")}</TableColumnHeader>
          </TableRow>
        </TableHead>
        <TableBody>
          {postings.map((posting) => {
            const name =
              categories.get(posting.account_id)?.path ??
              accounts.get(posting.account_id)?.name ??
              t("postings.unknownAccount");
            return (
              <TableRow key={posting.id}>
                <TableCell>
                  {name}
                  {posting.statement !== undefined &&
                    ` · ${t("postings.statement", {
                      month: formatReferenceMonth(posting.statement, locale),
                    })}`}
                  {posting.installment !== undefined &&
                    ` · ${t("postings.installment", {
                      number: posting.installment.number,
                      count: posting.installment.count,
                    })}`}
                </TableCell>
                <TableCell numeric>
                  {formatMoney(
                    posting.amount,
                    scale(posting.amount.currency),
                    locale,
                  )}
                </TableCell>
                <TableCell>
                  <Tag size="sm" tone={statusTone[posting.status ?? "cleared"]}>
                    {t(statusWords[posting.status ?? "cleared"])}
                  </Tag>
                </TableCell>
                <TableCell>
                  {posting.settled_on === undefined
                    ? ""
                    : formatDate(posting.settled_on, locale)}
                </TableCell>
                <TableCell>{posting.memo ?? ""}</TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </TableContent>
    </Table>
  );
}
