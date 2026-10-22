import { Button } from "@slotted/react/button";
import { Link } from "@slotted/react/link";
import { Stack } from "@slotted/react/stack";
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
import { Text } from "@slotted/react/typography";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";

import { useApi } from "@/api/api-context";
import type { components } from "@/api/schema.gen";
import { importBatchesQuery } from "@/features/accounts/api";
import { ImportCountTags } from "@/features/accounts/import-count-tags";
import { formatDate, formatMoney } from "@/i18n/format";
import type { MessageKey } from "@/i18n/catalog.en";
import { useAppLocale, useT } from "@/i18n/i18n-provider";
import { useAppLink } from "@/ui/use-app-link";

type Account = components["schemas"]["Account"];
type ImportBatch = components["schemas"]["ImportBatch"];

export const sourceLabel: Record<ImportBatch["source"], MessageKey> = {
  ofx: "imports.source.ofx",
  csv: "imports.source.csv",
  open_finance: "imports.source.open_finance",
};

// The statements imported into the account and the syncs that read it, newest first.
export function ImportsTab({
  account,
  scale,
}: {
  account: Account;
  scale: (code: string) => number;
}) {
  const t = useT();
  const [locale] = useAppLocale();
  const navigate = useNavigate();
  const follow = useAppLink();
  const batches = useQuery(importBatchesQuery(useApi(), account.id));
  const name = (b: ImportBatch) => b.file_name ?? t(sourceLabel[b.source]);
  return (
    <Stack gap={3}>
      <div>
        <Button
          variant="outline"
          onClick={() => {
            void navigate({
              to: "/accounts/$id/import",
              params: { id: account.id },
            });
          }}
        >
          {t("account.import")}
        </Button>
      </div>
      <Table columns={5} variant="framed">
        <TableContent>
          <TableCaption>{t("imports.caption")}</TableCaption>
          <TableHead>
            <TableRow>
              <TableColumnHeader>{t("imports.file")}</TableColumnHeader>
              <TableColumnHeader>{t("imports.started")}</TableColumnHeader>
              <TableColumnHeader>{t("imports.period")}</TableColumnHeader>
              <TableColumnHeader>{t("imports.outcome")}</TableColumnHeader>
              <TableColumnHeader>{t("imports.balance")}</TableColumnHeader>
            </TableRow>
          </TableHead>
          {batches.isPending ? (
            <TableLoader skeletonRows={3} />
          ) : (
            <TableBody>
              {(batches.data ?? []).length === 0 && (
                <TableEmpty>{t("imports.empty")}</TableEmpty>
              )}
              {(batches.data ?? []).map((b) => (
                <TableRow key={b.id} value={b.id}>
                  <TableRowHeader>
                    <Stack gap={0}>
                      <Link
                        variant="neutral"
                        underline="hover"
                        href={`/accounts/${account.id}/imports/${b.id}`}
                        onClick={follow({
                          to: "/accounts/$id/imports/$batchId",
                          params: { id: account.id, batchId: b.id },
                        })}
                      >
                        {name(b)}
                      </Link>
                      <Text size="xs" tone="muted">
                        {t(sourceLabel[b.source])}
                      </Text>
                    </Stack>
                  </TableRowHeader>
                  <TableCell>
                    {formatDate(b.started_at.slice(0, 10), locale)}
                  </TableCell>
                  <TableCell>
                    {b.period_from === undefined || b.period_to === undefined
                      ? ""
                      : t("imports.range", {
                          from: formatDate(b.period_from, locale),
                          to: formatDate(b.period_to, locale),
                        })}
                  </TableCell>
                  <TableCell>
                    <ImportCountTags counts={b.counts} />
                  </TableCell>
                  <TableCell>
                    <Text size="sm" tone="muted">
                      {b.balance.status === "recorded" &&
                      b.balance.amount !== undefined &&
                      b.balance.date !== undefined
                        ? t("imports.balanceRecorded", {
                            amount: formatMoney(
                              b.balance.amount,
                              scale(b.balance.amount.currency),
                              locale,
                            ),
                            date: formatDate(b.balance.date, locale),
                          })
                        : b.balance.status === "skipped"
                          ? t("imports.balanceSkipped")
                          : t("imports.balanceNone")}
                    </Text>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          )}
        </TableContent>
      </Table>
    </Stack>
  );
}
