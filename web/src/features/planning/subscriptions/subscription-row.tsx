import { Stack } from "@slotted/react/stack";
import { TableCell, TableRow, TableRowHeader } from "@slotted/react/table";
import { Text } from "@slotted/react/typography";

import { ScheduleActions } from "@/features/planning/subscriptions/schedule-actions";
import type { SubscriptionLine } from "@/features/planning/subscriptions/subscription-figures";
import { SubscriptionMonths } from "@/features/planning/subscriptions/subscription-months";
import styles from "@/features/planning/subscriptions/subscriptions.module.css";
import { formatBasisPoints } from "@/i18n/format";
import { useAppLocale, useT } from "@/i18n/i18n-provider";
import { useMoneyFormat } from "@/privacy/use-money-format";
import { AppLink } from "@/ui/navigation/app-link";

interface SubscriptionRowProps {
  line: SubscriptionLine;
  position: number;
  accountNames: ReadonlyMap<string, string>;
  scale: (code: string) => number;
}

// One subscription of the ranking: its place, the account it charges, its last 12
// months, its share of the total, and its monthly and yearly cost (spec C3).
export function SubscriptionRow({
  line,
  position,
  accountNames,
  scale,
}: SubscriptionRowProps) {
  const t = useT();
  const [locale] = useAppLocale();
  const fmt = useMoneyFormat();

  const { schedule, terms } = line;
  const name =
    schedule.description === "" ? t("ledger.untitled") : schedule.description;
  const money = (amount: number) =>
    fmt.money(
      { amount, currency: terms.amount.currency },
      scale(terms.amount.currency),
    );
  return (
    <TableRow value={schedule.id}>
      <TableCell numeric>
        <Text size="xs" tone="muted">
          {position}
        </Text>
      </TableCell>
      <TableRowHeader text="truncate">
        <Stack gap={0}>
          <AppLink
            variant="neutral"
            underline="hover"
            to={{ to: "/planning/schedules/$id", params: { id: schedule.id } }}
          >
            {name}
          </AppLink>
          <Text size="xs" tone="muted">
            {accountNames.get(schedule.account_id)}
          </Text>
        </Stack>
      </TableRowHeader>
      <TableCell>
        <SubscriptionMonths cells={line.cells} scale={scale} />
      </TableCell>
      <TableCell numeric>
        {line.shareBp === undefined ? (
          <Text size="xs" tone="muted">
            {t("subscriptions.outOfTotal")}
          </Text>
        ) : (
          <span className={styles.share}>
            <span className={styles.shareBar} aria-hidden="true">
              <i style={{ inlineSize: `${String(line.shareBp / 100)}%` }} />
            </span>
            <Text size="sm" numeric="tabular">
              {formatBasisPoints(line.shareBp, locale)}
            </Text>
          </span>
        )}
      </TableCell>
      <TableCell numeric>
        <Stack gap={0}>
          <Text size="sm" numeric="tabular">
            {money(line.monthly)}
          </Text>
          <Text size="xs" tone="muted" numeric="tabular">
            {t("subscriptions.perYearLine", { amount: money(line.yearly) })}
          </Text>
        </Stack>
      </TableCell>
      <TableCell sticky="end">
        <ScheduleActions schedule={schedule} name={name} />
      </TableCell>
    </TableRow>
  );
}
