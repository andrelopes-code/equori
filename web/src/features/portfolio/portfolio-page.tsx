import { Field, FieldLabel } from "@slotted/react/field";
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
import { useNavigate, useSearch } from "@tanstack/react-router";

import { PortfolioPositions } from "@/features/portfolio/portfolio-positions";
import { useT } from "@/i18n/i18n-provider";
import { useToday } from "@/i18n/today";
import { DateInput } from "@/ui/date-input";

// CP-04: the valuation date is a day, so it is the app's date input; its shortcuts stay out
// because a valuation reads any past day, not today and the two before.
export function PortfolioPage() {
  const t = useT();
  const today = useToday();
  const search = useSearch({ from: "/_authed/portfolio" });
  const navigate = useNavigate();
  const date = search.date ?? today;
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
            <PageHeaderActions>
              <Field>
                <FieldLabel>{t("portfolio.date")}</FieldLabel>
                <DateInput
                  name="date"
                  value={date}
                  shortcuts={false}
                  onChange={(next) => {
                    void navigate({
                      to: "/portfolio",
                      search: next === today ? {} : { date: next },
                      replace: true,
                    });
                  }}
                />
              </Field>
            </PageHeaderActions>
          </PageHeaderTitleRow>
        </PageHeaderTitleArea>
      </PageHeader>
      <PageBody>
        <Stack gap={6}>
          <PortfolioPositions date={date} />
        </Stack>
      </PageBody>
    </Page>
  );
}
