import { Field } from "@slotted/react/field";
import { NumberField } from "@slotted/react/number-field";
import { Page, PageBody } from "@slotted/react/page";
import {
  PageHeader,
  PageHeaderActions,
  PageHeaderHeading,
  PageHeaderSubheading,
  PageHeaderTabs,
  PageHeaderTitle,
  PageHeaderTitleArea,
  PageHeaderTitleRow,
} from "@slotted/react/page-header";
import { Stack } from "@slotted/react/stack";
import { Tab, TabList, Tabs } from "@slotted/react/tabs";
import { useQuery } from "@tanstack/react-query";
import { useNavigate, useSearch } from "@tanstack/react-router";

import { useApi } from "@/api/api-context";

import {
  incomeEventsQuery,
  realizedResultsQuery,
} from "@/features/portfolio/api";
import { IncomeEventsTab } from "@/features/portfolio/income-events-tab";
import { RealizedResultsTab } from "@/features/portfolio/realized-results-tab";
import { maxYear, minYear } from "@/features/portfolio/year-search";
import type { YearSearch, YearTab } from "@/features/portfolio/year-search";
import { formatDate } from "@/i18n/format";
import { useAppLocale, useT } from "@/i18n/i18n-provider";
import { useToday } from "@/i18n/today";
import { compactQuery, useMediaQuery } from "@/ui/use-media-query";

// CP-04: a year is stepped one at a time and typed when far away, so the control is a number
// field with steppers, limited to the range the contract accepts before any request. The year is
// the one in which the tax year starts; the range of the tax year is the one the response carries.
export function PortfolioYearPage() {
  const t = useT();
  const [tag] = useAppLocale();
  const today = useToday();
  const search = useSearch({ from: "/_authed/portfolio/year" });
  const navigate = useNavigate();
  const compact = useMediaQuery(compactQuery);
  const year = search.year ?? Number(today.slice(0, 4));
  const tab: YearTab = search.tab ?? "realized";
  const api = useApi();
  // Each tab reads the same query: the cache holds one request.
  const realized = useQuery({
    ...realizedResultsQuery(api, year),
    enabled: tab === "realized",
  });
  const income = useQuery({
    ...incomeEventsQuery(api, year),
    enabled: tab === "income",
  });
  const period = tab === "realized" ? realized.data : income.data;
  const change = (patch: YearSearch) => {
    void navigate({
      to: "/portfolio/year",
      search: { ...search, ...patch },
      replace: true,
    });
  };
  const tabs: { tab: YearTab; label: string }[] = [
    { tab: "realized", label: t("taxYear.tab.realized") },
    { tab: "income", label: t("taxYear.tab.income") },
  ];
  const yearField = (
    <Field>
      <NumberField
        aria-label={t("taxYear.year")}
        name="year"
        value={year}
        min={minYear}
        max={maxYear}
        locale={tag}
        format={{ useGrouping: false }}
        onValueChange={(next) => {
          if (
            next !== null &&
            Number.isInteger(next) &&
            next >= minYear &&
            next <= maxYear
          )
            change({ year: next });
        }}
      />
    </Field>
  );
  return (
    <Page width="full">
      <PageHeader size="lg">
        <PageHeaderTitleArea>
          <PageHeaderTitleRow>
            <PageHeaderTitle>
              <PageHeaderHeading>
                {t("taxYear.title", { year })}
              </PageHeaderHeading>
              <PageHeaderSubheading>
                {period === undefined
                  ? t("taxYear.range.pending")
                  : t("taxYear.range", {
                      from: formatDate(period.from, tag),
                      to: formatDate(period.to, tag),
                    })}
              </PageHeaderSubheading>
            </PageHeaderTitle>
            <PageHeaderActions>{!compact && yearField}</PageHeaderActions>
          </PageHeaderTitleRow>
        </PageHeaderTitleArea>
        <PageHeaderTabs>
          <Tabs
            value={tab}
            onValueChange={(value) => {
              const entry = tabs.find((e) => e.tab === value);
              if (entry !== undefined)
                change({ tab: entry.tab === "income" ? "income" : undefined });
            }}
          >
            <TabList aria-label={t("taxYear.tabs")}>
              {tabs.map((entry) => (
                <Tab key={entry.tab} value={entry.tab}>
                  {entry.label}
                </Tab>
              ))}
            </TabList>
          </Tabs>
        </PageHeaderTabs>
      </PageHeader>
      <PageBody>
        <Stack gap={6}>
          {compact && yearField}
          {tab === "realized" ? (
            <RealizedResultsTab year={year} />
          ) : (
            <IncomeEventsTab year={year} />
          )}
        </Stack>
      </PageBody>
    </Page>
  );
}
