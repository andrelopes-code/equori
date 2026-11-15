import { Stack } from "@slotted/react/stack";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableColumnHeader,
  TableContent,
  TableHead,
  TableRow,
  TableRowHeader,
} from "@slotted/react/table";
import { Text } from "@slotted/react/typography";

import {
  currentTerms,
  subscriptionCost,
} from "@/features/planning/model/schedule-words";
import type { PriceChange } from "@/features/planning/subscriptions/subscription-figures";
import { formatDate } from "@/i18n/format";
import { useAppLocale, useT } from "@/i18n/i18n-provider";
import { useToday } from "@/i18n/today";
import { useMoneyFormat } from "@/privacy/use-money-format";
import { AppLink } from "@/ui/navigation/app-link";

interface PriceChangesProps {
  changes: readonly PriceChange[];
  scale: (code: string) => number;
}

const tones = {
  rises: "warning",
  falls: "success",
  changed: "info",
  charged: "warning",
} as const;

// A price set to change, a price that changed within the year, a charge at another amount: the
// name over what changed and when, in the tone of the change; the prices over their effect,
// end-aligned. The name opens the schedule, where the terms change (spec C4).
export function PriceChanges({ changes, scale }: PriceChangesProps) {
  const t = useT();
  const [locale] = useAppLocale();
  const today = useToday();
  const fmt = useMoneyFormat();
  if (changes.length === 0) return null;

  const money = (m: PriceChange["from"]) => fmt.money(m, scale(m.currency));
  const yearly = (c: PriceChange) => {
    const recurrence = currentTerms(c.schedule.terms, today)?.recurrence;
    const amount =
      recurrence === undefined
        ? 0
        : subscriptionCost(recurrence, c.to.amount).yearly -
          subscriptionCost(recurrence, c.from.amount).yearly;
    return fmt.signed(
      { amount, currency: c.to.currency },
      scale(c.to.currency),
    );
  };
  const price = (c: PriceChange) =>
    c.kind === "charged"
      ? money(c.to)
      : t("subscriptions.priceFromTo", {
          from: money(c.from),
          to: money(c.to),
        });
  const effect = (c: PriceChange) =>
    c.kind === "charged"
      ? t("subscriptions.expectedLine", { amount: money(c.from) })
      : t("subscriptions.perYearLine", { amount: yearly(c) });

  return (
    <Table columns={2} variant="framed">
      <TableContent>
        <TableCaption>{t("subscriptions.changes")}</TableCaption>
        <TableHead>
          <TableRow>
            <TableColumnHeader>
              {t("subscriptions.subscription")}
            </TableColumnHeader>
            <TableColumnHeader numeric>
              {t("subscriptions.change")}
            </TableColumnHeader>
          </TableRow>
        </TableHead>
        <TableBody>
          {changes.map((c) => (
            <TableRow
              key={`${c.schedule.id}-${c.kind}`}
              value={`${c.schedule.id}-${c.kind}`}
            >
              <TableRowHeader text="truncate">
                <Stack gap={0}>
                  <AppLink
                    variant="neutral"
                    underline="hover"
                    to={{
                      to: "/planning/schedules/$id",
                      params: { id: c.schedule.id },
                    }}
                  >
                    {c.schedule.description}
                  </AppLink>
                  <Text size="xs" tone={tones[c.kind]}>
                    {t(`subscriptions.change.${c.kind}`, {
                      date: formatDate(c.on, locale),
                    })}
                  </Text>
                </Stack>
              </TableRowHeader>
              <TableCell numeric>
                <Stack gap={0}>
                  <Text size="sm" numeric="tabular">
                    {price(c)}
                  </Text>
                  <Text size="xs" tone="muted" numeric="tabular">
                    {effect(c)}
                  </Text>
                </Stack>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </TableContent>
    </Table>
  );
}
