import { Inline } from "@slotted/react/inline";
import { Stack } from "@slotted/react/stack";
import { TableCell, TableRow, TableRowHeader } from "@slotted/react/table";
import { Tag } from "@slotted/react/tag";
import { Text } from "@slotted/react/typography";

import type { AgendaRow as Row } from "@/features/planning/model/agenda";
import { dayCount } from "@/features/planning/model/day-count";
import { kindLabel, stateTone } from "@/features/planning/model/schedule-words";
import { OccurrenceActions } from "@/features/planning/occurrences/occurrence-actions";
import { OccurrenceReceived } from "@/features/planning/occurrences/occurrence-received";
import {
  formatDate,
  formatWeekdayDayMonth,
  formatRelativeDays,
} from "@/i18n/format";
import { useAppLocale, useT } from "@/i18n/i18n-provider";
import { useToday } from "@/i18n/today";
import { useMoneyFormat } from "@/privacy/use-money-format";

interface AgendaRowProps {
  row: Row;
  accountName: string;
  scale: (code: string) => number;
}

// One occurrence: its name over its kind and account, when it falls over its day (or how it
// ended, with its day, in one tag), and its expected amount, with what it moved once realized (spec A4).
export function AgendaRow({ row, accountName, scale }: AgendaRowProps) {
  const t = useT();
  const [locale] = useAppLocale();
  const today = useToday();
  const fmt = useMoneyFormat();

  const { occurrence, schedule } = row;
  const name =
    schedule === undefined || schedule.description === ""
      ? t("ledger.untitled")
      : schedule.description;
  const kind = schedule === undefined ? "" : t(kindLabel[schedule.kind]);
  const late = dayCount(occurrence.expected_on, today);
  const day = formatWeekdayDayMonth(occurrence.expected_on, locale);

  return (
    <TableRow value={occurrence.id} muted={occurrence.state === "skipped"}>
      <TableRowHeader text="truncate">
        <Stack gap={0}>
          {name}
          <Text size="xs" tone="muted">
            {[kind, accountName].filter((part) => part !== "").join(" · ")}
          </Text>
        </Stack>
      </TableRowHeader>
      <TableCell>
        <Stack gap={0} align="start">
          {occurrence.state === "overdue" && (
            <Tag size="sm" tone="danger">
              {t("agenda.stateOn", {
                state:
                  late === 1
                    ? t("agenda.lateOne")
                    : t("agenda.lateMany", { days: String(late) }),
                day,
              })}
            </Tag>
          )}
          {(occurrence.state === "realized" ||
            occurrence.state === "skipped") && (
            <Tag size="sm" tone={stateTone[occurrence.state]}>
              {t("agenda.stateOn", {
                state: t(`occurrence.state.${occurrence.state}`),
                day,
              })}
            </Tag>
          )}
          {occurrence.state === "expected" && (
            <Text size="sm">{formatRelativeDays(-late, locale)}</Text>
          )}
          {occurrence.state === "expected" && (
            <Text size="xs" tone="muted">
              {day}
            </Text>
          )}
          {occurrence.moved_from !== undefined && (
            <Text size="xs" tone="muted">
              {t("agenda.movedFrom", {
                date: formatDate(occurrence.moved_from, locale),
              })}
            </Text>
          )}
        </Stack>
      </TableCell>
      <TableCell numeric>
        {fmt.signed(row.money, scale(row.money.currency))}
        <OccurrenceReceived
          occurrence={occurrence}
          income={schedule?.kind === "income"}
        />
      </TableCell>
      <TableCell sticky="end">
        <Inline gap={2} wrap="nowrap" justify="end">
          <OccurrenceActions
            occurrence={occurrence}
            name={name}
            quick={
              schedule?.kind === "income"
                ? t("occurrence.markReceived")
                : t("occurrence.markPaid")
            }
          />
        </Inline>
      </TableCell>
    </TableRow>
  );
}
