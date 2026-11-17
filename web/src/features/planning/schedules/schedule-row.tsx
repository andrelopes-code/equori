import { Inline } from "@slotted/react/inline";
import { Stack } from "@slotted/react/stack";
import { TableCell, TableRow, TableRowHeader } from "@slotted/react/table";
import { Tag } from "@slotted/react/tag";
import { Text } from "@slotted/react/typography";

import type { components } from "@/api/schema.gen";
import { nextWords } from "@/features/planning/model/next-words";
import {
  currentTerms,
  kindLabel,
  recurrenceWords,
  subscriptionCost,
} from "@/features/planning/model/schedule-words";
import { formatDate } from "@/i18n/format";
import { useAppLocale, useT } from "@/i18n/i18n-provider";
import { useToday } from "@/i18n/today";
import { useMoneyFormat } from "@/privacy/use-money-format";
import { AppLink } from "@/ui/navigation/app-link";

type Schedule = components["schemas"]["Schedule"];

interface ScheduleRowProps {
  schedule: Schedule;
  accountNames: ReadonlyMap<string, string>;
  // The next expected occurrence, when there is one.
  nextOn: string | undefined;
  scale: (code: string) => number;
  // An ended schedule sits outside the table of its kind, so the row names the kind itself, and
  // it draws muted.
  ended?: boolean;
}

const flowSign: Partial<Record<Schedule["kind"], number>> = {
  income: 1,
  transfer: 0,
};

// One schedule: where its money goes and how often, its next occurrence and end, its amount and
// the change of terms already set (spec B3, B4).
export function ScheduleRow({
  schedule: s,
  accountNames,
  nextOn,
  scale,
  ended = false,
}: ScheduleRowProps) {
  const t = useT();
  const [locale] = useAppLocale();
  const today = useToday();
  const fmt = useMoneyFormat();

  const terms = currentTerms(s.terms, today);
  const ahead = s.terms.find((v) => v.effective_from > today);
  const name = s.description === "" ? t("ledger.untitled") : s.description;
  const where = [
    accountNames.get(s.account_id),
    accountNames.get(s.counterpart_id),
  ]
    .filter((part) => part !== undefined)
    .join(" · ");
  // Income adds, a transfer moves between own accounts, every other kind takes (spec B3).
  const sign = flowSign[s.kind] ?? -1;
  const monthly =
    terms === undefined ||
    (terms.recurrence.frequency === "monthly" &&
      terms.recurrence.interval === 1);
  const change =
    terms !== undefined && ahead !== undefined
      ? t(
          ahead.amount.amount > terms.amount.amount
            ? "schedules.rises"
            : "schedules.falls",
          {
            amount: fmt.money(ahead.amount, scale(ahead.amount.currency)),
            date: formatDate(ahead.effective_from, locale),
          },
        )
      : undefined;
  const link = (
    <AppLink
      variant="neutral"
      underline="hover"
      to={{ to: "/planning/schedules/$id", params: { id: s.id } }}
    >
      {name}
    </AppLink>
  );

  return (
    <TableRow value={s.id} muted={ended}>
      <TableRowHeader text="truncate">
        {ended ? (
          <Inline align="center" wrap="wrap" gap={4}>
            {link}
            <Tag size="sm" tone="secondary">
              {t(kindLabel[s.kind])}
            </Tag>
          </Inline>
        ) : (
          link
        )}
      </TableRowHeader>
      <TableCell text="truncate">
        <Stack gap={0}>
          <Text size="sm">{where}</Text>
          {terms !== undefined && (
            <Text size="xs" tone="muted">
              {recurrenceWords(terms.recurrence, t, locale)}
            </Text>
          )}
        </Stack>
      </TableCell>
      <TableCell>
        <Stack gap={0}>
          <Text size="sm">
            {nextOn === undefined
              ? t("schedules.none")
              : nextWords(nextOn, today, locale)}
          </Text>
          {s.ends_on !== undefined && (
            <Text size="xs" tone="muted">
              {t("schedules.endsOn", { date: formatDate(s.ends_on, locale) })}
            </Text>
          )}
        </Stack>
      </TableCell>
      <TableCell numeric>
        {terms !== undefined && (
          <Stack gap={0}>
            <Text
              size="sm"
              numeric="tabular"
              tone={sign > 0 ? "success" : undefined}
            >
              {fmt.signed(
                { ...terms.amount, amount: sign * terms.amount.amount },
                scale(terms.amount.currency),
              )}
            </Text>
            {change !== undefined && (
              <Text size="xs" tone="info">
                {change}
              </Text>
            )}
            {change === undefined && !monthly && (
              <Text size="xs" tone="muted" numeric="tabular">
                {t("schedules.perMonth", {
                  amount: fmt.money(
                    {
                      amount: subscriptionCost(
                        terms.recurrence,
                        terms.amount.amount,
                      ).monthly,
                      currency: terms.amount.currency,
                    },
                    scale(terms.amount.currency),
                  ),
                })}
              </Text>
            )}
          </Stack>
        )}
      </TableCell>
    </TableRow>
  );
}
