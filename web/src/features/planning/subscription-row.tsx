import { TableCell, TableRow, TableRowHeader } from "@slotted/react/table";
import { Text } from "@slotted/react/typography";
import { Fragment } from "react";

import type { components } from "@/api/schema.gen";
import { ScheduleActions } from "@/features/planning/schedule-actions";
import type { subscriptionCost } from "@/features/planning/schedule-words";
import styles from "@/features/planning/subscriptions-tab.module.css";
import { formatDate } from "@/i18n/format";
import { useAppLocale, useT } from "@/i18n/i18n-provider";
import { useMoneyFormat } from "@/privacy/use-money-format";
import { AppLink } from "@/ui/app-link";

type Schedule = components["schemas"]["Schedule"];
type ScheduleTerms = components["schemas"]["ScheduleTerms"];

interface SubscriptionRowProps {
  schedule: Schedule;
  // The terms in force today.
  terms: ScheduleTerms;
  cost: ReturnType<typeof subscriptionCost>;
  accountNames: ReadonlyMap<string, string>;
  scale: (code: string) => number;
  // An ended subscription draws muted.
  ended?: boolean;
}

// One subscription of the subscriptions table: its price in force, what it costs a month and a
// year, and how its price moved.
export function SubscriptionRow({
  schedule,
  terms,
  cost,
  accountNames,
  scale,
  ended = false,
}: SubscriptionRowProps) {
  const t = useT();
  const [locale] = useAppLocale();
  const fmt = useMoneyFormat();
  const name =
    schedule.description === "" ? t("ledger.untitled") : schedule.description;
  const money = (amount: number) =>
    fmt.money(
      { amount, currency: terms.amount.currency },
      scale(terms.amount.currency),
    );

  return (
    <TableRow value={schedule.id} muted={ended}>
      <TableRowHeader text="truncate">
        <AppLink
          variant="neutral"
          underline="hover"
          to={{
            to: "/planning/schedules/$id",
            params: { id: schedule.id },
          }}
        >
          {name}
        </AppLink>
      </TableRowHeader>
      <TableCell text="truncate">
        {accountNames.get(schedule.account_id)}
      </TableCell>
      <TableCell numeric>{money(terms.amount.amount)}</TableCell>
      <TableCell numeric>{money(cost.monthly)}</TableCell>
      <TableCell numeric>{money(cost.yearly)}</TableCell>
      <TableCell>
        <div className={styles.history}>
          {schedule.terms.map((v) => (
            <Fragment key={v.effective_from}>
              <Text size="sm" tone="muted" numeric="tabular">
                {formatDate(v.effective_from, locale)}
              </Text>
              <Text
                size="sm"
                numeric="tabular"
                {...(ended ? { tone: "muted" as const } : {})}
              >
                {fmt.money(v.amount, scale(v.amount.currency))}
              </Text>
            </Fragment>
          ))}
        </div>
      </TableCell>
      <TableCell>
        {schedule.ends_on === undefined
          ? t("schedule.noEnd")
          : formatDate(schedule.ends_on, locale)}
      </TableCell>
      <TableCell sticky="end">
        <ScheduleActions schedule={schedule} name={name} />
      </TableCell>
    </TableRow>
  );
}
