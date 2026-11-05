import { Inline } from "@slotted/react/inline";
import { Tag } from "@slotted/react/tag";
import { TableCell, TableRow, TableRowHeader } from "@slotted/react/table";

import type { components } from "@/api/schema.gen";
import {
  currentTerms,
  kindLabel,
  recurrenceWords,
  subscriptionCost,
} from "@/features/planning/schedule-words";
import { formatDate } from "@/i18n/format";
import { useAppLocale, useT } from "@/i18n/i18n-provider";
import { useToday } from "@/i18n/today";
import { useMoneyFormat } from "@/privacy/use-money-format";
import { AppLink } from "@/ui/app-link";

type Schedule = components["schemas"]["Schedule"];

interface ScheduleRowProps {
  schedule: Schedule;
  accountNames: ReadonlyMap<string, string>;
  // The next expected occurrence, when there is one.
  nextOn: string | undefined;
  scale: (code: string) => number;
  // An ended schedule sits outside the group of its kind, so the row names the kind itself, and
  // it draws muted.
  ended?: boolean;
}

// One schedule of the schedules table: its terms in force today and its next occurrence.
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
  const link = (
    <AppLink
      variant="neutral"
      underline="hover"
      to={{ to: "/planning/schedules/$id", params: { id: s.id } }}
    >
      {s.description === "" ? t("ledger.untitled") : s.description}
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
      <TableCell text="truncate">{accountNames.get(s.account_id)}</TableCell>
      <TableCell text="truncate">
        {accountNames.get(s.counterpart_id)}
      </TableCell>
      <TableCell numeric>
        {terms !== undefined &&
          fmt.money(terms.amount, scale(terms.amount.currency))}
      </TableCell>
      <TableCell numeric>
        {terms !== undefined &&
          s.kind !== "transfer" &&
          fmt.money(
            {
              amount: subscriptionCost(terms.recurrence, terms.amount.amount)
                .yearly,
              currency: terms.amount.currency,
            },
            scale(terms.amount.currency),
          )}
      </TableCell>
      <TableCell>
        {terms !== undefined && recurrenceWords(terms.recurrence, t, locale)}
      </TableCell>
      <TableCell>
        {nextOn === undefined
          ? t("schedules.none")
          : formatDate(nextOn, locale)}
      </TableCell>
      <TableCell>
        {s.ends_on === undefined
          ? t("schedule.noEnd")
          : formatDate(s.ends_on, locale)}
      </TableCell>
    </TableRow>
  );
}
