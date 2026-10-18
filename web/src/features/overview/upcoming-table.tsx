import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableContent,
  TableRow,
  TableRowHeader,
  TableSummary,
} from "@slotted/react/table";
import {
  Section,
  SectionActions,
  SectionBody,
  SectionHeader,
  SectionHeading,
  SectionTitle,
} from "@slotted/react/section";
import { Text } from "@slotted/react/typography";
import { VisuallyHidden } from "@slotted/react/visually-hidden";

import styles from "@/features/overview/overview-page.module.css";
import type { Overview } from "@/features/overview/use-overview";
import { formatDayMonth } from "@/i18n/format";
import { useAppLocale, useT } from "@/i18n/i18n-provider";
import { MoneyFigure } from "@/ui/money-figure";
import { MoneyText } from "@/ui/money-text";

const separator = " · ";

// Complete frontend O5: the remaining occurrences, closed by the forecast balance.
export function UpcomingTable({
  overview,
  scale,
}: {
  overview: Overview;
  scale: (currency: string) => number;
}) {
  const t = useT();
  const [locale] = useAppLocale();
  const s = scale(overview.base);
  const end = overview.days.at(-1)?.date ?? `${overview.month}-01`;
  return (
    <Section>
      <SectionHeader>
        <SectionTitle>
          <SectionHeading>{t("overview.ahead")}</SectionHeading>
        </SectionTitle>
        <SectionActions>
          <Text size="sm" tone="muted">
            <MoneyText
              money={{
                amount: overview.closing - overview.today,
                currency: overview.base,
              }}
              scale={s}
              symbol={false}
            />
          </Text>
        </SectionActions>
      </SectionHeader>
      <SectionBody>
        <div className={styles.block}>
          <Table columns={3}>
            <TableContent>
              <TableCaption>
                <VisuallyHidden>{t("overview.ahead")}</VisuallyHidden>
              </TableCaption>
              <TableBody>
                {overview.ahead.length === 0 && (
                  <TableRow>
                    <TableCell>
                      <Text size="sm" tone="muted">
                        {t("overview.ahead.empty", {
                          date: formatDayMonth(end, locale),
                        })}
                      </Text>
                    </TableCell>
                    <TableCell />
                    <TableCell />
                  </TableRow>
                )}
                {overview.ahead.map((event) => (
                  <TableRow key={event.occurrenceID}>
                    <TableCell text="nowrap">
                      <time dateTime={event.date} className={styles.muted}>
                        {formatDayMonth(event.date, locale)}
                      </time>
                    </TableCell>
                    <TableRowHeader>
                      {event.description}
                      {event.kind !== undefined && (
                        <span className={styles.muted}>
                          {separator + t(`schedule.kind.${event.kind}`)}
                        </span>
                      )}
                    </TableRowHeader>
                    <TableCell numeric text="nowrap">
                      <MoneyText
                        money={{
                          amount: event.amount,
                          currency: overview.base,
                        }}
                        scale={s}
                        symbol={false}
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
              <TableSummary>
                <TableRow>
                  <TableCell text="nowrap">
                    <span className={styles.muted}>
                      {formatDayMonth(end, locale)}
                    </span>
                  </TableCell>
                  <TableRowHeader>{t("overview.ahead.total")}</TableRowHeader>
                  <TableCell numeric text="nowrap">
                    <MoneyFigure
                      money={{
                        amount: overview.closing,
                        currency: overview.base,
                      }}
                      scale={s}
                      size="md"
                      tone="accent"
                    />
                  </TableCell>
                </TableRow>
              </TableSummary>
            </TableContent>
          </Table>
          <Text size="xs" tone="muted">
            {t("overview.ahead.note")}
          </Text>
        </div>
      </SectionBody>
    </Section>
  );
}
