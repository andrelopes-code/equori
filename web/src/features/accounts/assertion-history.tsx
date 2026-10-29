import { Button } from "@slotted/react/button";
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
import { Tag } from "@slotted/react/tag";
import { useInfiniteQuery } from "@tanstack/react-query";

import { useApi } from "@/api/api-context";
import { assertionsQuery } from "@/features/accounts/api";
import type { MessageKey } from "@/i18n/catalog.en";
import { formatDate } from "@/i18n/format";
import { useAppLocale, useT } from "@/i18n/i18n-provider";
import { useMoneyFormat } from "@/privacy/use-money-format";

const sourceLabel: Record<"manual" | "import" | "aggregator", MessageKey> = {
  manual: "reconciliation.source.manual",
  import: "reconciliation.source.import",
  aggregator: "reconciliation.source.aggregator",
};

interface AssertionHistoryProps {
  accountId: string;
  scale: (code: string) => number;
}

// The institution balances recorded so far, each with whether it matched.
export function AssertionHistory({ accountId, scale }: AssertionHistoryProps) {
  const t = useT();
  const [locale] = useAppLocale();
  const fmt = useMoneyFormat();
  const history = useInfiniteQuery(assertionsQuery(useApi(), accountId));

  const assertions = (history.data?.pages ?? []).flatMap((page) => page.items);

  return (
    <Stack gap={3}>
      <Table columns={5} variant="framed">
        <TableContent>
          <TableCaption>{t("reconciliation.history")}</TableCaption>
          <TableHead>
            <TableRow>
              <TableColumnHeader>{t("reconciliation.date")}</TableColumnHeader>
              <TableColumnHeader numeric>
                {t("reconciliation.reported")}
              </TableColumnHeader>
              <TableColumnHeader>
                {t("reconciliation.source")}
              </TableColumnHeader>
              <TableColumnHeader>
                {t("reconciliation.recordedAt")}
              </TableColumnHeader>
              <TableColumnHeader>{t("reconciliation.state")}</TableColumnHeader>
            </TableRow>
          </TableHead>
          {history.isPending ? (
            <TableLoader skeletonRows={3} />
          ) : (
            <TableBody>
              {assertions.length === 0 && (
                <TableEmpty>{t("reconciliation.historyEmpty")}</TableEmpty>
              )}
              {assertions.map((a) => (
                <TableRow key={a.id} value={a.id}>
                  <TableRowHeader>{formatDate(a.date, locale)}</TableRowHeader>
                  <TableCell numeric>
                    {fmt.money(a.amount, scale(a.amount.currency))}
                  </TableCell>
                  <TableCell>{t(sourceLabel[a.source])}</TableCell>
                  <TableCell>
                    {formatDate(a.recorded_at.slice(0, 10), locale)}
                  </TableCell>
                  <TableCell>
                    {a.reconciled ? (
                      <Tag size="sm" tone="success">
                        {t("reconciliation.matched")}
                      </Tag>
                    ) : (
                      <Tag size="sm" tone="warning">
                        {t("reconciliation.unmatched")}
                      </Tag>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          )}
        </TableContent>
      </Table>

      {history.hasNextPage && (
        <div>
          <Button
            variant="outline"
            tone="secondary"
            loading={history.isFetchingNextPage}
            onClick={() => void history.fetchNextPage()}
          >
            {t("reconciliation.more")}
          </Button>
        </div>
      )}
    </Stack>
  );
}
