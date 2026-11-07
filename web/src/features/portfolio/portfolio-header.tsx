import { ButtonLink } from "@slotted/react/button";
import { Inline } from "@slotted/react/inline";
import {
  PageHeader,
  PageHeaderActions,
  PageHeaderHeading,
  PageHeaderSubheading,
  PageHeaderTitle,
  PageHeaderTitleArea,
  PageHeaderTitleRow,
} from "@slotted/react/page-header";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";

import { useApi } from "@/api/api-context";
import { HelpLink } from "@/features/help";
import type { SearchPatch } from "@/features/portfolio/portfolio-search";
import { instrumentsQuery } from "@/features/setup";
import { useT } from "@/i18n/i18n-provider";
import { ChoiceSelect } from "@/ui/choice-select";
import { DateInput } from "@/ui/date-input";

interface PortfolioHeaderProps {
  date: string;
  today: string;
  valueIn: string | undefined;
  base: string | undefined;
  onChange: (patch: SearchPatch) => void;
}

// PC9. CP-04: the valuation date is a day, so it is the app's date input; its shortcuts stay out
// because a valuation reads any past day, not today and the two before. The valuation currency is
// chosen among the currencies of the instrument catalog.
export function PortfolioHeader({
  date,
  today,
  valueIn,
  base,
  onChange,
}: PortfolioHeaderProps) {
  const t = useT();
  const instruments = useQuery(instrumentsQuery(useApi()));

  const currencies = (instruments.data?.items ?? [])
    .filter((i) => i.type === "currency")
    .map((i) => ({ value: i.code, label: i.code }));

  return (
    <PageHeader size="lg">
      <PageHeaderTitleArea>
        <PageHeaderTitleRow>
          <PageHeaderTitle>
            <PageHeaderHeading>{t("nav.portfolio")}</PageHeaderHeading>
            <PageHeaderSubheading>
              {t("holdings.subtitle")}
            </PageHeaderSubheading>
          </PageHeaderTitle>
          {/* A page header's controls carry no visible label; each names itself to assistive
              technology. */}
          <PageHeaderActions>
            <Inline gap={3} wrap="nowrap">
              <HelpLink page="portfolio" />
              <ChoiceSelect
                label={t("portfolio.valueIn")}
                choices={currencies}
                multiple={false}
                value={valueIn ?? null}
                onChange={(next) => {
                  if (typeof next === "string")
                    onChange({ value_in: next === base ? undefined : next });
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
                  onChange({ date: next === today ? undefined : next });
                }}
              />
              <ButtonLink
                variant="outline"
                tone="secondary"
                render={(props) => <Link {...props} to="/portfolio/year" />}
              >
                {t("holdings.year")}
              </ButtonLink>
            </Inline>
          </PageHeaderActions>
        </PageHeaderTitleRow>
      </PageHeaderTitleArea>
    </PageHeader>
  );
}
