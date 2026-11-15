import {
  Table,
  TableBody,
  TableCaption,
  TableColumnHeader,
  TableContent,
  TableEmpty,
  TableHead,
  TableLoader,
  TableRow,
} from "@slotted/react/table";

import type { SubscriptionLine } from "@/features/planning/subscriptions/subscription-figures";
import { SubscriptionRow } from "@/features/planning/subscriptions/subscription-row";
import { useT } from "@/i18n/i18n-provider";

interface RankingTableProps {
  lines: readonly SubscriptionLine[];
  accountNames: ReadonlyMap<string, string>;
  scale: (code: string) => number;
  loading: boolean;
}

// The active subscriptions from the most to the least expensive a month (spec C3).
export function RankingTable({
  lines,
  accountNames,
  scale,
  loading,
}: RankingTableProps) {
  const t = useT();

  return (
    <Table columns={6} variant="framed">
      <TableContent>
        <TableCaption>{t("subscriptions.ranking")}</TableCaption>
        <TableHead>
          <TableRow>
            <TableColumnHeader numeric>
              {t("subscriptions.position")}
            </TableColumnHeader>
            <TableColumnHeader>
              {t("subscriptions.subscription")}
            </TableColumnHeader>
            <TableColumnHeader>{t("subscriptions.months")}</TableColumnHeader>
            <TableColumnHeader numeric>
              {t("subscriptions.share")}
            </TableColumnHeader>
            <TableColumnHeader numeric>
              {t("subscriptions.monthly")}
            </TableColumnHeader>
            <TableColumnHeader sticky="end">
              {t("agenda.actions")}
            </TableColumnHeader>
          </TableRow>
        </TableHead>
        {loading ? (
          <TableLoader skeletonRows={6} />
        ) : (
          <TableBody>
            {lines.length === 0 && (
              <TableEmpty>{t("subscriptions.empty")}</TableEmpty>
            )}
            {lines.map((line, index) => (
              <SubscriptionRow
                key={line.schedule.id}
                line={line}
                position={index + 1}
                accountNames={accountNames}
                scale={scale}
              />
            ))}
          </TableBody>
        )}
      </TableContent>
    </Table>
  );
}
