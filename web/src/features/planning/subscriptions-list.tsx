import { List } from "@slotted/react/list";
import {
  ListItem,
  ListItemActions,
  ListItemBody,
  ListItemDescription,
  ListItemEnd,
  ListItemLabel,
  ListItemLink,
} from "@slotted/react/list-item";
import { Skeleton } from "@slotted/react/skeleton";
import { Stack } from "@slotted/react/stack";
import { Text } from "@slotted/react/typography";

import type { components } from "@/api/schema.gen";
import { ScheduleActions } from "@/features/planning/schedule-actions";
import { formatDate } from "@/i18n/format";
import { useAppLocale, useT } from "@/i18n/i18n-provider";
import { useMoneyFormat } from "@/privacy/use-money-format";
import { useAppLink } from "@/ui/use-app-link";

type Money = components["schemas"]["Money"];
type Schedule = components["schemas"]["Schedule"];

export interface SubscriptionRow {
  schedule: Schedule;
  terms: { amount: Money };
  cost: { monthly: number; yearly: number };
}

// Below 600 px the subscriptions are rows (mobile.md M1, record work): name and account, the
// monthly and yearly cost under them, the price at the end, the total above the rows.
export function SubscriptionsList({
  rows,
  names,
  scale,
  loading,
  totals,
}: {
  rows: SubscriptionRow[];
  names: ReadonlyMap<string, string>;
  scale: ((code: string) => number) | null;
  loading: boolean;
  totals: { monthly: Money; yearly: Money } | undefined;
}) {
  const t = useT();
  const [locale] = useAppLocale();
  const fmt = useMoneyFormat();
  const follow = useAppLink();
  if (loading || scale === null)
    return (
      <Stack gap={2} aria-busy="true">
        <Skeleton shape="block" blockSize="4rem" />
        <Skeleton shape="block" blockSize="4rem" />
      </Stack>
    );
  const money = (amount: number, currency: string) =>
    fmt.money({ amount, currency }, scale(currency));
  return (
    <Stack gap={3}>
      {totals !== undefined && rows.length > 0 && (
        <Text size="sm" tone="muted">
          {[
            t("subscriptions.total"),
            [
              money(totals.monthly.amount, totals.monthly.currency),
              money(totals.yearly.amount, totals.yearly.currency),
            ].join(" / "),
          ].join(": ")}
        </Text>
      )}
      <List aria-label={t("subscriptions.caption")} variant="framed">
        {rows.map(({ schedule, terms, cost }) => {
          const name =
            schedule.description === ""
              ? t("ledger.untitled")
              : schedule.description;
          const currency = terms.amount.currency;
          return (
            <ListItem key={schedule.id}>
              <ListItemLink
                href={`/planning/schedules/${schedule.id}`}
                onClick={follow({
                  to: "/planning/schedules/$id",
                  params: { id: schedule.id },
                })}
              >
                <ListItemBody>
                  <ListItemLabel>{name}</ListItemLabel>
                  <ListItemDescription>
                    {names.get(schedule.account_id) ?? ""}
                  </ListItemDescription>
                  <ListItemDescription>
                    {[
                      [
                        t("subscriptions.monthly"),
                        money(cost.monthly, currency),
                      ].join(": "),
                      [
                        t("subscriptions.yearly"),
                        money(cost.yearly, currency),
                      ].join(": "),
                    ].join(" · ")}
                  </ListItemDescription>
                  {schedule.ends_on !== undefined && (
                    <ListItemDescription>
                      {[
                        t("schedules.ends"),
                        formatDate(schedule.ends_on, locale),
                      ].join(": ")}
                    </ListItemDescription>
                  )}
                </ListItemBody>
                <ListItemEnd>
                  {money(terms.amount.amount, currency)}
                </ListItemEnd>
              </ListItemLink>
              <ListItemActions>
                <ScheduleActions schedule={schedule} name={name} />
              </ListItemActions>
            </ListItem>
          );
        })}
      </List>
    </Stack>
  );
}
