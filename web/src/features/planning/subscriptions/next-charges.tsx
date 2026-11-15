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

import { nextWords } from "@/features/planning/model/next-words";
import type { NextCharge } from "@/features/planning/subscriptions/subscription-figures";
import { useAppLocale, useT } from "@/i18n/i18n-provider";
import { useToday } from "@/i18n/today";
import { useMoneyFormat } from "@/privacy/use-money-format";

interface NextChargesProps {
  charges: readonly NextCharge[];
  scale: (code: string) => number;
}

// The next five expected charges of the subscriptions (spec C4).
export function NextCharges({ charges, scale }: NextChargesProps) {
  const t = useT();
  const [locale] = useAppLocale();
  const today = useToday();
  const fmt = useMoneyFormat();
  if (charges.length === 0) return null;

  return (
    <Table columns={3} variant="framed">
      <TableContent>
        <TableCaption>{t("subscriptions.next")}</TableCaption>
        <TableHead>
          <TableRow>
            <TableColumnHeader>
              {t("subscriptions.subscription")}
            </TableColumnHeader>
            <TableColumnHeader>{t("agenda.when")}</TableColumnHeader>
            <TableColumnHeader numeric>
              {t("schedules.amount")}
            </TableColumnHeader>
          </TableRow>
        </TableHead>
        <TableBody>
          {charges.map((c) => (
            <TableRow
              key={`${c.schedule.id}-${c.on}`}
              value={`${c.schedule.id}-${c.on}`}
            >
              <TableRowHeader text="truncate">
                {c.schedule.description}
              </TableRowHeader>
              <TableCell>{nextWords(c.on, today, locale)}</TableCell>
              <TableCell numeric>
                {fmt.money(c.amount, scale(c.amount.currency))}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </TableContent>
    </Table>
  );
}
