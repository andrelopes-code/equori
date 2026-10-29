import { ButtonLink } from "@slotted/react/button";
import { Link } from "@tanstack/react-router";
import { Inline } from "@slotted/react/inline";
import { Page, PageBody } from "@slotted/react/page";
import {
  PageHeader,
  PageHeaderActions,
  PageHeaderHeading,
  PageHeaderSubheading,
  PageHeaderTitle,
  PageHeaderTitleArea,
  PageHeaderTitleRow,
} from "@slotted/react/page-header";
import { Stack } from "@slotted/react/stack";
import { Heading } from "@slotted/react/typography";
import { useQuery } from "@tanstack/react-query";
import { useNavigate, useSearch } from "@tanstack/react-router";

import { useApi } from "@/api/api-context";
import { PortfolioAllocation } from "@/features/portfolio/portfolio-allocation";
import { PortfolioPositions } from "@/features/portfolio/portfolio-positions";
import { PortfolioReturn } from "@/features/portfolio/portfolio-return";
import type { SearchPatch } from "@/features/portfolio/portfolio-search";
import { instrumentsQuery, settingsQuery } from "@/features/setup";
import { useT } from "@/i18n/i18n-provider";
import { useToday } from "@/i18n/today";
import { ChoiceSelect } from "@/ui/choice-select";
import { DateInput } from "@/ui/date-input";

import styles from "@/features/portfolio/portfolio-page.module.css";

// CP-04: the valuation date is a day, so it is the app's date input; its shortcuts stay out
// because a valuation reads any past day, not today and the two before. The valuation
// currency is chosen among the currencies of the instrument catalog.
export function PortfolioPage() {
  const t = useT();
  const today = useToday();
  const api = useApi();
  const search = useSearch({ from: "/_authed/portfolio" });
  const navigate = useNavigate();
  const base = useQuery(settingsQuery(api)).data?.base_currency;
  const instruments = useQuery(instrumentsQuery(api));
  const date = search.date ?? today;
  const valueIn = search.value_in ?? base;
  const currencies = (instruments.data?.items ?? [])
    .filter((i) => i.type === "currency")
    .map((i) => ({ value: i.code, label: i.code }));
  const change = (patch: SearchPatch) => {
    const next = Object.fromEntries(
      Object.entries({ ...search, ...patch }).filter(
        ([, value]) => value !== undefined,
      ),
    );
    void navigate({
      to: "/portfolio",
      search: next,
      replace: true,
    });
  };
  const yearLink = (
    <ButtonLink
      variant="outline"
      tone="secondary"
      render={(props) => <Link {...props} to="/portfolio/year" />}
    >
      {t("taxYear.open")}
    </ButtonLink>
  );
  return (
    <Page width="full">
      <PageHeader size="lg">
        <PageHeaderTitleArea>
          <PageHeaderTitleRow>
            <PageHeaderTitle>
              <PageHeaderHeading>{t("nav.portfolio")}</PageHeaderHeading>
              <PageHeaderSubheading>
                {t("portfolio.subtitle")}
              </PageHeaderSubheading>
            </PageHeaderTitle>
            {/* A page header's controls carry no visible label; each names itself to assistive
                technology. */}
            <PageHeaderActions>
              <Inline gap={3} wrap="nowrap">
                <ChoiceSelect
                  label={t("portfolio.valueIn")}
                  choices={currencies}
                  multiple={false}
                  value={valueIn ?? null}
                  onChange={(next) => {
                    if (typeof next === "string")
                      change({ value_in: next === base ? undefined : next });
                  }}
                />
                <DateInput
                  name="date"
                  value={date}
                  shortcuts={false}
                  messages={{
                    choose: t("portfolio.date"),
                    change: ({ date: day }) =>
                      t("portfolio.dateChange", { date: day }),
                  }}
                  onChange={(next) => {
                    change({ date: next === today ? undefined : next });
                  }}
                />
              </Inline>
            </PageHeaderActions>
          </PageHeaderTitleRow>
        </PageHeaderTitleArea>
      </PageHeader>
      <PageBody>
        <Stack gap={6}>
          <Stack gap={3}>
            <Inline gap={3} align="center" justify="between" wrap="wrap">
              <Heading level={2} size="md">
                {t("portfolio.positions.title")}
              </Heading>
              {yearLink}
            </Inline>
            <PortfolioPositions date={date} valueIn={valueIn} />
          </Stack>
          <div className={styles.pair}>
            <Stack gap={3}>
              <PortfolioAllocation
                date={date}
                by={search.by ?? "type"}
                valueIn={valueIn}
                onBy={(by) => {
                  change({ by: by === "type" ? undefined : by });
                }}
              />
            </Stack>
            <Stack gap={3}>
              <Heading level={2} size="md">
                {t("portfolio.return.title")}
              </Heading>
              <PortfolioReturn
                date={date}
                valueIn={valueIn}
                search={search}
                onChange={change}
              />
            </Stack>
          </div>
        </Stack>
      </PageBody>
    </Page>
  );
}
