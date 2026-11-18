import { List } from "@slotted/react/list";
import {
  ListItem,
  ListItemBody,
  ListItemDescription,
  ListItemLabel,
  ListItemLink,
} from "@slotted/react/list-item";
import {
  Section,
  SectionBody,
  SectionDescription,
  SectionHeader,
  SectionHeading,
  SectionTitle,
} from "@slotted/react/section";
import { Stack } from "@slotted/react/stack";
import { Text } from "@slotted/react/typography";

import { BreakEvenLine } from "@/features/instruments/fund-report/break-even-line";
import { reportStale } from "@/features/instruments/fund-report/fund-figures";
import { FundReportFigures } from "@/features/instruments/fund-report/fund-report-figures";
import { useFundReport } from "@/features/instruments/fund-report/use-fund-report";
import { catalogLabel } from "@/features/setup";
import { formatDate, formatReferenceMonth } from "@/i18n/format";
import { useAppLocale, useT } from "@/i18n/i18n-provider";
import { useToday } from "@/i18n/today";

interface FundReportProps {
  code: string;
  // The quote currency of the instrument; null when it has none.
  quote: string | null;
}

// FR7 to FR11: the figures of the latest monthly report of a listed fund, read against its price
// and the real interest curve. Draws nothing for an instrument without a report.
export function FundReport({ code, quote }: FundReportProps) {
  const t = useT();
  const [locale] = useAppLocale();
  const today = useToday();
  const { report, figures, reference, growth, priceDate, otherCurrency } =
    useFundReport(code, quote);

  if (report === undefined || figures === null) return null;

  const description = [
    report.name,
    report.segment,
    t("fundReport.month", {
      month: formatReferenceMonth(figures.period.slice(0, 7), locale),
    }),
    figures.delivered === null
      ? ""
      : t("fundReport.delivered", {
          date: formatDate(figures.delivered, locale),
        }),
  ]
    .filter((part) => part !== "")
    .join(" · ");
  const stale = reportStale(figures.period, today);

  return (
    <Section size="lg">
      <SectionHeader>
        <SectionTitle>
          <SectionHeading>{t("fundReport.title")}</SectionHeading>
          <SectionDescription>{description}</SectionDescription>
        </SectionTitle>
      </SectionHeader>

      <SectionBody>
        <Stack gap={6}>
          {stale && (
            <Text size="sm" tone="warning">
              {t("fundReport.stale")}
            </Text>
          )}

          <FundReportFigures
            figures={figures}
            currency={report.currency}
            priceDate={priceDate}
            otherCurrency={otherCurrency}
          />

          <BreakEvenLine
            figures={figures}
            reference={reference}
            growth={growth}
            otherCurrency={otherCurrency}
          />

          <Text size="sm" tone="muted">
            {t("fundReport.method")}
          </Text>

          <List aria-label={t("fundReport.title")} variant="framed">
            <ListItem>
              <ListItemLink
                href={report.source_url}
                target="_blank"
                rel="noopener noreferrer"
              >
                <ListItemBody>
                  <ListItemLabel>{t("fundReport.link")}</ListItemLabel>
                  <ListItemDescription>
                    {catalogLabel(
                      t,
                      `marketData.feed.${report.source}`,
                      report.source,
                    )}
                  </ListItemDescription>
                </ListItemBody>
              </ListItemLink>
            </ListItem>
          </List>
        </Stack>
      </SectionBody>
    </Section>
  );
}
