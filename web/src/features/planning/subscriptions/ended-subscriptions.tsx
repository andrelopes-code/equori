import {
  Collapsible,
  CollapsibleHeader,
  CollapsiblePanel,
  CollapsibleTrigger,
} from "@slotted/react/collapsible";
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

import type { SubscriptionLine } from "@/features/planning/subscriptions/subscription-figures";
import { formatDate } from "@/i18n/format";
import { useAppLocale, useT } from "@/i18n/i18n-provider";
import { useMoneyFormat } from "@/privacy/use-money-format";

interface EndedSubscriptionsProps {
  lines: readonly SubscriptionLine[];
  scale: (code: string) => number;
}

// The subscriptions that ended, closed under the others, muted and without actions (spec C4).
export function EndedSubscriptions({ lines, scale }: EndedSubscriptionsProps) {
  const t = useT();
  const [locale] = useAppLocale();
  const fmt = useMoneyFormat();
  if (lines.length === 0) return null;

  return (
    <Collapsible variant="framed" mount="active">
      <CollapsibleHeader>
        <CollapsibleTrigger>
          {t("subscriptions.endedCount", { count: String(lines.length) })}
        </CollapsibleTrigger>
      </CollapsibleHeader>

      <CollapsiblePanel>
        <Table columns={3} variant="plain" edges="flush">
          <TableContent>
            <TableCaption visuallyHidden>{t("schedules.ended")}</TableCaption>
            <TableHead>
              <TableRow>
                <TableColumnHeader>
                  {t("subscriptions.subscription")}
                </TableColumnHeader>
                <TableColumnHeader>{t("schedules.ends")}</TableColumnHeader>
                <TableColumnHeader numeric>
                  {t("subscriptions.monthly")}
                </TableColumnHeader>
              </TableRow>
            </TableHead>
            <TableBody>
              {lines.map((line) => (
                <TableRow key={line.schedule.id} value={line.schedule.id} muted>
                  <TableRowHeader text="truncate">
                    {line.schedule.description}
                  </TableRowHeader>
                  <TableCell>
                    {line.schedule.ends_on === undefined
                      ? ""
                      : formatDate(line.schedule.ends_on, locale)}
                  </TableCell>
                  <TableCell numeric>
                    {fmt.money(
                      {
                        amount: line.monthly,
                        currency: line.terms.amount.currency,
                      },
                      scale(line.terms.amount.currency),
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </TableContent>
        </Table>
      </CollapsiblePanel>
    </Collapsible>
  );
}
