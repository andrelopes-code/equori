import { Field, FieldLabel } from "@slotted/react/field";
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
import { Tab, TabList, Tabs } from "@slotted/react/tabs";
import { useNavigate, useSearch } from "@tanstack/react-router";

import { RealizedResultsTab } from "@/features/portfolio/realized-results-tab";
import { maxYear, minYear } from "@/features/portfolio/year-search";
import type { YearSearch, YearTab } from "@/features/portfolio/year-search";
import { formatDate } from "@/i18n/format";
import { useAppLocale, useT } from "@/i18n/i18n-provider";
import { useToday } from "@/i18n/today";

// CP-04: a year is stepped one at a time and typed when far away, so the control is a number
// field with steppers, limited to the range the contract accepts before any request. The year is
// the calendar year: the contract has no fiscal year of a jurisdiction.
export function PortfolioYearPage() {
  const t = useT();
  const [tag] = useAppLocale();
  const today = useToday();
  const search = useSearch({ from: "/_authed/portfolio/year" });
  const navigate = useNavigate();
  const year = search.year ?? Number(today.slice(0, 4));
  const tab: YearTab = search.tab ?? "realized";
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
                {t("taxYear.range", {
                  from: formatDate(`${String(year)}-01-01`, tag),
                  to: formatDate(`${String(year)}-12-31`, tag),
                })}
              </PageHeaderSubheading>
            </PageHeaderTitle>
            <PageHeaderActions>
              <Field>
                <FieldLabel>{t("taxYear.year")}</FieldLabel>
                <NumberField
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
            </PageHeaderActions>
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
        {tab === "realized" && <RealizedResultsTab year={year} />}
      </PageBody>
    </Page>
  );
}
