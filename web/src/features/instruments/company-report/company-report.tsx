import { useQuery } from "@tanstack/react-query";
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

import { useApi } from "@/api/api-context";
import { companyReportsQuery } from "@/features/instruments/api";
import { companyFigures } from "@/features/instruments/company-report/company-figures";
import { CompanyMultiples } from "@/features/instruments/company-report/company-multiples";
import { CompanyReportFigures } from "@/features/instruments/company-report/company-report-figures";
import { piotroskiSignals } from "@/features/instruments/company-report/piotroski";
import { PiotroskiList } from "@/features/instruments/company-report/piotroski-list";
import { catalogLabel } from "@/features/setup";
import { formatDate } from "@/i18n/format";
import { useAppLocale, useT } from "@/i18n/i18n-provider";

interface CompanyReportProps {
  code: string;
}

// CR7 to CR11: the figures and the Piotroski signals of the statements a company files with the
// regulator. Draws nothing for an instrument without a report.
export function CompanyReport({ code }: CompanyReportProps) {
  const t = useT();
  const [locale] = useAppLocale();
  const api = useApi();
  const report = useQuery(companyReportsQuery(api, code)).data?.[0];

  const figures = report === undefined ? null : companyFigures(report);

  if (report === undefined || figures === null) return null;

  const newest = report.periods[0];
  const date = formatDate(figures.balance, locale);
  const description = [
    t(
      report.consolidated
        ? "companyReport.consolidated"
        : "companyReport.individual",
    ),
    newest?.months === 12
      ? t("companyReport.fiscalYear", { date })
      : t("companyReport.quarter", { months: String(newest?.months), date }),
    figures.delivered === null
      ? ""
      : t("companyReport.delivered", {
          date: formatDate(figures.delivered, locale),
        }),
  ]
    .filter((part) => part !== "")
    .join(" · ");

  return (
    <Section size="lg">
      <SectionHeader>
        <SectionTitle>
          <SectionHeading>{t("companyReport.title")}</SectionHeading>
          <SectionDescription>{description}</SectionDescription>
        </SectionTitle>
      </SectionHeader>

      <SectionBody>
        <Stack gap={8}>
          <Stack gap={6}>
            <Text size="sm" truncate title={report.name}>
              {report.name}
            </Text>

            <CompanyMultiples code={code} />
          </Stack>

          <CompanyReportFigures figures={figures} />

          <PiotroskiList
            signals={piotroskiSignals(report.periods, report.plan)}
            plan={report.plan}
          />

          <Text size="sm" tone="muted">
            {t("companyReport.method")}
          </Text>

          <List aria-label={t("companyReport.title")} variant="framed">
            <ListItem>
              <ListItemLink
                href={report.source_url}
                target="_blank"
                rel="noopener noreferrer"
              >
                <ListItemBody>
                  <ListItemLabel>{t("companyReport.link")}</ListItemLabel>
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
