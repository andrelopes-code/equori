import { IconButton } from "@slotted/react/button";
import { Glyph, Icon } from "@slotted/react/icon";
import { Inline } from "@slotted/react/inline";
import { Menu, MenuContent, MenuItem, MenuTrigger } from "@slotted/react/menu";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableColumnHeader,
  TableContent,
  TableEmpty,
  TableGroupRow,
  TableHead,
  TableRow,
  TableRowHeader,
} from "@slotted/react/table";
import { Tag } from "@slotted/react/tag";
import { Text } from "@slotted/react/typography";
import { VisuallyHidden } from "@slotted/react/visually-hidden";
import { useNavigate } from "@tanstack/react-router";
import { Fragment, useMemo } from "react";
import type { ReactNode } from "react";

import type { components } from "@/api/schema.gen";
import { DisputeTag } from "@/features/cards/dispute-tag";
import { lineAmount } from "@/features/cards/line-amount";
import type { MessageKey } from "@/i18n/catalog.en";
import { formatDayHeader, formatMoney } from "@/i18n/format";
import { useAppLocale, useT } from "@/i18n/i18n-provider";
import { useToday } from "@/i18n/today";

type StatementPosting = components["schemas"]["StatementPosting"];

const roleWords: Record<StatementPosting["card_role"], MessageKey> = {
  charge: "statement.role.charge",
  credit: "statement.role.credit",
  payment: "statement.role.payment",
};

// A statement's lines are bounded by its cycle, so a table (LP-14), banded by day with the day's
// total at the end of each band. A purchase reads as the amount it adds to the bill; a credit or a
// payment carries the minus sign.
export function StatementLines({
  lines,
  scale,
  lineActions,
}: {
  lines: readonly StatementPosting[];
  scale: (code: string) => number;
  // The commands of a charge besides opening its transaction (refund, dispute, installment plan).
  lineActions?: (line: StatementPosting) => ReactNode;
}) {
  const t = useT();
  const [locale] = useAppLocale();
  const today = useToday();
  const navigate = useNavigate();
  const days = useMemo(() => {
    const byDay = new Map<string, StatementPosting[]>();
    for (const line of [...lines].sort((a, b) =>
      b.date.localeCompare(a.date),
    )) {
      byDay.set(line.date, [...(byDay.get(line.date) ?? []), line]);
    }
    return [...byDay.entries()];
  }, [lines]);
  return (
    <Table columns={4} variant="framed">
      <TableContent>
        <TableCaption>{t("statement.lines")}</TableCaption>
        <TableHead>
          <TableRow>
            <TableColumnHeader>{t("ledger.movement")}</TableColumnHeader>
            <TableColumnHeader>{t("statement.role")}</TableColumnHeader>
            <TableColumnHeader numeric>
              {t("statement.amount")}
            </TableColumnHeader>
            <TableColumnHeader align="end">
              <VisuallyHidden>{t("links.actions")}</VisuallyHidden>
            </TableColumnHeader>
          </TableRow>
        </TableHead>
        <TableBody>
          {lines.length === 0 && (
            <TableEmpty>{t("statement.noLines")}</TableEmpty>
          )}
          {days.map(([day, dayLines]) => {
            const net = dayLines.reduce(
              (sum, line) => sum + lineAmount(line).money.amount,
              0,
            );
            const currency = dayLines[0]?.amount.currency ?? "BRL";
            return (
              <Fragment key={day}>
                <TableGroupRow
                  end={formatMoney(
                    { amount: net, currency },
                    scale(currency),
                    locale,
                  )}
                >
                  {formatDayHeader(day, today, locale, {
                    today: t("day.today"),
                    yesterday: t("day.yesterday"),
                  })}
                </TableGroupRow>
                {dayLines.map((line, i) => {
                  const { money, tone } = lineAmount(line);
                  return (
                    <TableRow
                      key={`${line.transaction_id}-${String(i)}`}
                      value={line.transaction_id}
                    >
                      <TableRowHeader>
                        <Inline gap={2}>
                          <Text size="sm" weight="medium">
                            {line.description === ""
                              ? t("ledger.untitled")
                              : line.description}
                          </Text>
                          {line.installment !== undefined && (
                            <Text size="xs" tone="muted">
                              {t("statement.installment", {
                                number: line.installment.number,
                                count: line.installment.count,
                              })}
                            </Text>
                          )}
                          {line.card_role === "charge" && (
                            <DisputeTag transactionId={line.transaction_id} />
                          )}
                        </Inline>
                      </TableRowHeader>
                      <TableCell>
                        <Tag
                          size="sm"
                          tone={
                            line.card_role === "charge"
                              ? "secondary"
                              : "success"
                          }
                        >
                          {t(roleWords[line.card_role])}
                        </Tag>
                      </TableCell>
                      <TableCell numeric>
                        <Text
                          size="sm"
                          weight="semibold"
                          tone={tone === "positive" ? "success" : "default"}
                        >
                          {formatMoney(money, scale(money.currency), locale)}
                        </Text>
                      </TableCell>
                      <TableCell align="end">
                        <Menu>
                          <MenuTrigger
                            render={(props) => (
                              <IconButton
                                {...props}
                                size="sm"
                                variant="ghost"
                                tone="secondary"
                                aria-label={t("statement.lineActions", {
                                  name: line.description,
                                })}
                              >
                                <Icon>
                                  <Glyph name="ellipsis" />
                                </Icon>
                              </IconButton>
                            )}
                          />
                          <MenuContent>
                            <MenuItem
                              onSelect={() => {
                                void navigate({
                                  to: "/transactions/$id",
                                  params: { id: line.transaction_id },
                                });
                              }}
                            >
                              {t("statement.openTransaction")}
                            </MenuItem>
                            {lineActions?.(line)}
                          </MenuContent>
                        </Menu>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </Fragment>
            );
          })}
        </TableBody>
      </TableContent>
    </Table>
  );
}
