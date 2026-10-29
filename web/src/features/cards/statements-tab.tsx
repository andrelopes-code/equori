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
import { Tag } from "@slotted/react/tag";
import { Text } from "@slotted/react/typography";

import type { components } from "@/api/schema.gen";
import { statementAmount } from "@/features/cards/statement-amount";
import {
  statementStatusTone,
  statementStatusWords,
} from "@/features/cards/statement-words";
import { formatDate, formatMonthTitle } from "@/i18n/format";
import { useAppLocale, useT } from "@/i18n/i18n-provider";
import { PhoneList } from "@/ui/phone-list";
import { compactQuery, useMediaQuery } from "@/ui/use-media-query";
import { routeTo } from "@/ui/route-to";
import { useMoneyFormat } from "@/privacy/use-money-format";

type Statement = components["schemas"]["StatementSummary"];

// Every statement from `from` on, newest first; a statement the institution reported with a
// different total says by how much.
export function StatementsTab({
  accountId,
  statements,
  loading,
  onEarlier,
  scale,
}: {
  accountId: string;
  statements: readonly Statement[];
  loading: boolean;
  onEarlier: () => void;
  scale: (code: string) => number;
}) {
  const t = useT();
  const [locale] = useAppLocale();
  const fmt = useMoneyFormat();
  const money = (m: components["schemas"]["Money"]) =>
    fmt.money(m, scale(m.currency));
  const compact = useMediaQuery(compactQuery);
  const rows = [...statements].reverse();
  return (
    <Stack gap={3}>
      {compact ? (
        <PhoneList
          label={t("card.statements")}
          loading={loading}
          empty={t("card.noStatements")}
          rows={rows.map((s) => ({
            key: s.id,
            title: formatMonthTitle(s.reference, locale),
            link: {
              to: "/cards/$accountId/statements/$statementId",
              params: { accountId, statementId: s.id },
            },
            lines: [
              [
                [t("card.closing"), formatDate(s.closing_date, locale)].join(
                  ": ",
                ),
                [t("card.due"), formatDate(s.due_date, locale)].join(": "),
              ].join(" · "),
              [t("card.unpaid"), money(s.unpaid)].join(": "),
              <Tag key="status" size="sm" tone={statementStatusTone[s.status]}>
                {t(statementStatusWords[s.status])}
              </Tag>,
              s.amount_difference !== undefined &&
              s.amount_difference.amount !== 0 ? (
                <Text key="difference" size="xs" tone="warning">
                  {t("card.institutionDiffers", {
                    amount: money(s.amount_difference),
                  })}
                </Text>
              ) : null,
            ].filter((line) => line !== null),
            end: money(statementAmount(s)),
          }))}
        />
      ) : (
        <Table columns={7} variant="framed">
          <TableContent>
            <TableCaption>{t("card.statements")}</TableCaption>
            <TableHead>
              <TableRow>
                <TableColumnHeader>{t("card.reference")}</TableColumnHeader>
                <TableColumnHeader>{t("card.closing")}</TableColumnHeader>
                <TableColumnHeader>{t("card.due")}</TableColumnHeader>
                <TableColumnHeader numeric>
                  {t("card.amountDue")}
                </TableColumnHeader>
                <TableColumnHeader numeric>
                  {t("card.settled")}
                </TableColumnHeader>
                <TableColumnHeader numeric>
                  {t("card.unpaid")}
                </TableColumnHeader>
                <TableColumnHeader>{t("card.status")}</TableColumnHeader>
              </TableRow>
            </TableHead>
            {loading ? (
              <TableLoader skeletonRows={6} />
            ) : (
              <TableBody>
                {rows.length === 0 && (
                  <TableEmpty>{t("card.noStatements")}</TableEmpty>
                )}
                {rows.map((s) => (
                  <TableRow key={s.id} value={s.id}>
                    <TableRowHeader>
                      <Stack gap={0}>
                        <Link
                          variant="neutral"
                          underline="hover"
                          render={routeTo({
                            to: "/cards/$accountId/statements/$statementId",
                            params: { accountId, statementId: s.id },
                          })}
                        >
                          {formatMonthTitle(s.reference, locale)}
                        </Link>
                        {s.amount_difference !== undefined &&
                          s.amount_difference.amount !== 0 && (
                            <Text size="xs" tone="warning">
                              {t("card.institutionDiffers", {
                                amount: money(s.amount_difference),
                              })}
                            </Text>
                          )}
                      </Stack>
                    </TableRowHeader>
                    <TableCell>{formatDate(s.closing_date, locale)}</TableCell>
                    <TableCell>{formatDate(s.due_date, locale)}</TableCell>
                    <TableCell numeric>{money(statementAmount(s))}</TableCell>
                    <TableCell numeric>{money(s.settled)}</TableCell>
                    <TableCell numeric>{money(s.unpaid)}</TableCell>
                    <TableCell>
                      <Tag size="sm" tone={statementStatusTone[s.status]}>
                        {t(statementStatusWords[s.status])}
                      </Tag>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            )}
          </TableContent>
        </Table>
      )}
      <div>
        <Button variant="outline" tone="secondary" onClick={onEarlier}>
          {t("card.earlier")}
        </Button>
      </div>
    </Stack>
  );
}
