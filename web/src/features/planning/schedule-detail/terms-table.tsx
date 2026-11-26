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
import { VisuallyHidden } from "@slotted/react/visually-hidden";

import type { components } from "@/api/schema.gen";
import { recurrenceWords } from "@/features/planning/model/schedule-words";
import { TermsMenu } from "@/features/planning/schedule-detail/terms-menu";
import { formatDate } from "@/i18n/format";
import { useAppLocale, useT } from "@/i18n/i18n-provider";
import { useMoneyFormat } from "@/privacy/use-money-format";

type Schedule = components["schemas"]["Schedule"];

interface TermsTableProps {
  schedule: Schedule;
  scale: (code: string) => number;
  editable: boolean;
  onRevise: () => void;
  onRemove: () => void;
}

// The terms versions of a schedule; the latest row holds its menu while the schedule runs.
export function TermsTable({
  schedule,
  scale,
  editable,
  onRevise,
  onRemove,
}: TermsTableProps) {
  const t = useT();
  const [locale] = useAppLocale();
  const fmt = useMoneyFormat();

  const latest = schedule.terms.at(-1)?.effective_from;

  return (
    <Table columns={4} variant="framed">
      <TableContent>
        <TableCaption>{t("schedule.terms")}</TableCaption>
        <TableHead>
          <TableRow>
            <TableColumnHeader>{t("schedule.effectiveFrom")}</TableColumnHeader>
            <TableColumnHeader numeric>
              {t("schedule.amount")}
            </TableColumnHeader>
            <TableColumnHeader>{t("schedules.recurrence")}</TableColumnHeader>
            <TableColumnHeader align="end">
              <VisuallyHidden>{t("links.actions")}</VisuallyHidden>
            </TableColumnHeader>
          </TableRow>
        </TableHead>
        <TableBody>
          {schedule.terms.map((v) => (
            <TableRow key={v.effective_from} value={v.effective_from}>
              <TableRowHeader>
                {formatDate(v.effective_from, locale)}
              </TableRowHeader>
              <TableCell numeric>
                {fmt.money(v.amount, scale(v.amount.currency))}
              </TableCell>
              <TableCell>{recurrenceWords(v.recurrence, t, locale)}</TableCell>
              <TableCell align="end">
                {editable && v.effective_from === latest && (
                  <TermsMenu
                    date={v.effective_from}
                    removable={schedule.terms.length > 1}
                    onRevise={onRevise}
                    onRemove={onRemove}
                  />
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </TableContent>
    </Table>
  );
}
