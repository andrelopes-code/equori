import { Field } from "@slotted/react/field";
import { NumberField } from "@slotted/react/number-field";
import { Page, PageBody } from "@slotted/react/page";
import { Segment, SegmentedControl } from "@slotted/react/segmented-control";
import { useQuery } from "@tanstack/react-query";
import { useNavigate, useSearch } from "@tanstack/react-router";

import { useApi } from "@/api/api-context";
import {
  gainTaxQuery,
  incomeEventsQuery,
  realizedResultsQuery,
} from "@/features/portfolio/api";
import { PortfolioAreaHeader } from "@/features/portfolio/area-header/portfolio-area-header";
import { GainTaxTab } from "@/features/portfolio/gain-tax/gain-tax-tab";
import { IncomeEventsTab } from "@/features/portfolio/income-events/income-events-tab";
import { RealizedResultsTab } from "@/features/portfolio/realized-results/realized-results-tab";
import { maxYear, minYear } from "@/features/portfolio/pages/year-search";
import type {
  YearSearch,
  YearTab,
} from "@/features/portfolio/pages/year-search";
import { formatDate } from "@/i18n/format";
import { useAppLocale, useT } from "@/i18n/i18n-provider";
import { useToday } from "@/i18n/today";
import { PageStack } from "@/ui/page-layout/page-stack";

// CP-04: a year is stepped one at a time and typed when far away, so the control is a number
// field with steppers, limited to the range the contract accepts before any request. The year is
// the one in which the tax year starts; the range of the tax year is the one the response carries.
export function PortfolioYearPage() {
  const t = useT();
  const [tag] = useAppLocale();
  const today = useToday();
  const search = useSearch({ from: "/_authed/portfolio/year" });
  const navigate = useNavigate();
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
  const gainTax = useQuery({
    ...gainTaxQuery(api, year),
    enabled: tab === "gain_tax",
  });
  const period = { realized, income, gain_tax: gainTax }[tab].data;
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
    { tab: "gain_tax", label: t("taxYear.tab.gainTax") },
  ];
  return (
    <Page width="full">
      <PortfolioAreaHeader
        tab="year"
        subheading={
          period === undefined
            ? t("taxYear.range.pending")
            : t("taxYear.range", {
                from: formatDate(period.from, tag),
                to: formatDate(period.to, tag),
              })
        }
        controls={
          <Field necessity="none">
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
        }
        help="portfolio"
      />

      <PageBody>
        <PageStack>
          <SegmentedControl
            aria-label={t("taxYear.tabs")}
            value={tab}
            onValueChange={(value) => {
              const entry = tabs.find((e) => e.tab === value);
              if (entry !== undefined)
                change({
                  tab: entry.tab === "realized" ? undefined : entry.tab,
                });
            }}
          >
            {tabs.map((entry) => (
              <Segment key={entry.tab} value={entry.tab}>
                {entry.label}
              </Segment>
            ))}
          </SegmentedControl>

          {tab === "realized" && <RealizedResultsTab year={year} />}
          {tab === "income" && <IncomeEventsTab year={year} />}
          {tab === "gain_tax" && <GainTaxTab year={year} />}
        </PageStack>
      </PageBody>
    </Page>
  );
}
