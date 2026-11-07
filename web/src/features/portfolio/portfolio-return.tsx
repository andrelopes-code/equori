import { Alert, AlertContent, AlertDescription } from "@slotted/react/alert";
import { Inline } from "@slotted/react/inline";
import {
  Section,
  SectionActions,
  SectionBody,
  SectionDescription,
  SectionHeader,
  SectionHeading,
  SectionTitle,
} from "@slotted/react/section";
import { Skeleton } from "@slotted/react/skeleton";
import { Stack } from "@slotted/react/stack";
import { Text } from "@slotted/react/typography";
import { useQuery } from "@tanstack/react-query";

import { useApi } from "@/api/api-context";
import { ProblemError } from "@/api/problem";
import { indexName } from "@/features/calculators";
import { returnQuery } from "@/features/portfolio/api";
import {
  defaultFrom,
  periodProblem,
} from "@/features/portfolio/portfolio-period";
import { PortfolioProblem } from "@/features/portfolio/portfolio-problem";
import type {
  PortfolioSearch,
  SearchPatch,
} from "@/features/portfolio/portfolio-search";
import { ReturnFigures } from "@/features/portfolio/return-figures";
import {
  useReturnOptions,
  wholePortfolio,
} from "@/features/portfolio/use-return-options";
import { useScale } from "@/features/setup";
import { useT } from "@/i18n/i18n-provider";
import { useToday } from "@/i18n/today";
import { ChoiceSelect } from "@/ui/choice-select";
import { PeriodControl } from "@/ui/period-control";
import type { Period } from "@/ui/period-control";
import { QueryError } from "@/ui/query-error";

interface PortfolioReturnProps {
  date: string;
  valueIn: string | undefined;
  search: PortfolioSearch;
  onChange: (patch: SearchPatch) => void;
}

// PC10: the return of the whole portfolio or of one account tree over a period of at most 366
// days; the period starts as the 12 months ending at the valuation date, and a day after today
// holds nothing to read, so the request stops at today.
export function PortfolioReturn({
  date,
  valueIn,
  search,
  onChange,
}: PortfolioReturnProps) {
  const t = useT();
  const api = useApi();
  const today = useToday();
  const scale = useScale();
  const { accounts, options, loaded } = useReturnOptions();

  const yearFrom = defaultFrom(date);
  const to = search.to ?? date;
  const from = search.from ?? yearFrom;
  const asked = search.to !== undefined && search.to > today ? today : to;
  const selected =
    options.find((o) => o.value === search.account)?.value ?? options[0]?.value;
  const accountID = selected === wholePortfolio ? null : selected;
  const problem = periodProblem(from, to);
  const report = useQuery(
    returnQuery(api, accountID, from, asked, valueIn, problem === undefined),
  );
  const undefinedReturn =
    report.error instanceof ProblemError &&
    report.error.problem.code === "return_undefined";
  const index =
    report.data?.benchmark === undefined
      ? undefined
      : indexName(report.data.benchmark.index);
  const ready = report.data !== undefined && scale !== null;
  const noAccount = loaded && selected === undefined;
  const reading = !accounts.isError && !noAccount && problem === undefined;

  function handlePeriod(next: Period | undefined) {
    const whole =
      next === undefined || (next.from === yearFrom && next.to === date);

    onChange({
      from: whole ? undefined : next.from,
      to: whole ? undefined : next.to,
    });
  }

  return (
    <Section size="lg" aria-label={t("holdings.return")}>
      <SectionHeader>
        <SectionTitle>
          <SectionHeading>{t("holdings.return")}</SectionHeading>
          {index !== undefined && report.data !== undefined && (
            <SectionDescription>
              {t(`portfolio.yield.profile.${report.data.profile}`, { index })}
            </SectionDescription>
          )}
        </SectionTitle>
        <SectionActions>
          <Inline gap={3} align="center" wrap="nowrap">
            <ChoiceSelect
              label={t("portfolio.return.account")}
              choices={options}
              multiple={false}
              value={selected ?? null}
              onChange={(next) => {
                if (typeof next === "string")
                  onChange({
                    account: next === options[0]?.value ? undefined : next,
                  });
              }}
            />
            <PeriodControl
              value={{ from, to }}
              allowAll={false}
              extraPresets={[
                {
                  key: "last-12-months",
                  label: "holdings.period.year",
                  from: yearFrom,
                  to: date,
                },
              ]}
              onChange={handlePeriod}
            />
          </Inline>
        </SectionActions>
      </SectionHeader>
      <SectionBody>
        {accounts.isError && (
          <QueryError
            error={accounts.error}
            onRetry={() => void accounts.refetch()}
          />
        )}

        {noAccount && !accounts.isError && (
          <Text size="sm" tone="muted">
            {t("portfolio.return.noAccount")}
          </Text>
        )}

        {problem !== undefined && !accounts.isError && !noAccount && (
          <Alert tone="warning">
            <AlertContent>
              <AlertDescription>
                {t(
                  problem === "tooLong"
                    ? "portfolio.return.periodTooLong"
                    : "portfolio.return.periodReversed",
                )}
              </AlertDescription>
            </AlertContent>
          </Alert>
        )}

        {reading && undefinedReturn && (
          <Stack gap={1}>
            <Text weight="semibold">{t("portfolio.return.undefined")}</Text>
            <Text size="sm" tone="muted">
              {t("portfolio.return.undefinedWhy")}
            </Text>
          </Stack>
        )}

        {reading && report.isError && !undefinedReturn && (
          <PortfolioProblem
            error={report.error}
            currency={valueIn}
            onRetry={() => void report.refetch()}
          />
        )}

        {reading && !report.isError && !ready && <Skeleton />}

        {reading && !report.isError && ready && (
          <ReturnFigures report={report.data} />
        )}
      </SectionBody>
    </Section>
  );
}
