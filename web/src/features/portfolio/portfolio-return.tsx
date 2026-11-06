import { Alert, AlertContent, AlertDescription } from "@slotted/react/alert";
import { Field, FieldLabel } from "@slotted/react/field";
import { Skeleton } from "@slotted/react/skeleton";
import { Stack } from "@slotted/react/stack";
import { Text } from "@slotted/react/typography";
import { useQuery } from "@tanstack/react-query";

import { useApi } from "@/api/api-context";
import { ProblemError } from "@/api/problem";
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
import { ChoiceSelect } from "@/ui/choice-select";
import { DateInput } from "@/ui/date-input";
import { QueryError } from "@/ui/query-error";

interface PortfolioReturnProps {
  date: string;
  valueIn: string | undefined;
  search: PortfolioSearch;
  onChange: (patch: SearchPatch) => void;
}

// The money-weighted annual return of the whole portfolio or of one account tree over a period of at most 366 days; the
// period starts as the 12 months ending at the valuation date.
export function PortfolioReturn({
  date,
  valueIn,
  search,
  onChange,
}: PortfolioReturnProps) {
  const t = useT();
  const api = useApi();
  const scale = useScale();
  const { accounts, options, loaded } = useReturnOptions();
  const to = search.to ?? date;
  const from = search.from ?? defaultFrom(to);
  const selected =
    options.find((o) => o.value === search.account)?.value ?? options[0]?.value;
  const accountID = selected === wholePortfolio ? null : selected;
  const problem = periodProblem(from, to);
  const report = useQuery(
    returnQuery(api, accountID, from, to, valueIn, problem === undefined),
  );
  const setDay = (key: "from" | "to", next: string) => {
    const fallback = key === "to" ? date : defaultFrom(to);
    onChange({ [key]: next === fallback ? undefined : next });
  };
  let body;
  if (accounts.isError)
    body = (
      <QueryError
        error={accounts.error}
        onRetry={() => void accounts.refetch()}
      />
    );
  else if (loaded && selected === undefined)
    body = (
      <Text size="sm" tone="muted">
        {t("portfolio.return.noAccount")}
      </Text>
    );
  else if (problem !== undefined)
    body = (
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
    );
  else if (report.isError) {
    const undefinedReturn =
      report.error instanceof ProblemError &&
      report.error.problem.code === "return_undefined";
    body = undefinedReturn ? (
      <Stack gap={1}>
        <Text weight="semibold">{t("portfolio.return.undefined")}</Text>
        <Text size="sm" tone="muted">
          {t("portfolio.return.undefinedWhy")}
        </Text>
      </Stack>
    ) : (
      <PortfolioProblem
        error={report.error}
        currency={valueIn}
        onRetry={() => void report.refetch()}
      />
    );
  } else if (report.data === undefined || scale === null) body = <Skeleton />;
  else body = <ReturnFigures report={report.data} from={from} />;
  return (
    <Stack gap={3}>
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
      <Field necessity="none">
        <FieldLabel>{t("portfolio.return.from")}</FieldLabel>
        <DateInput
          name="from"
          value={from}
          shortcuts={false}
          onChange={(next) => {
            setDay("from", next);
          }}
        />
      </Field>
      <Field necessity="none">
        <FieldLabel>{t("portfolio.return.to")}</FieldLabel>
        <DateInput
          name="to"
          value={to}
          shortcuts={false}
          onChange={(next) => {
            setDay("to", next);
          }}
        />
      </Field>
      {valueIn !== undefined && (
        <Text size="sm" tone="muted">
          {t("portfolio.valuedIn", { currency: valueIn })}
        </Text>
      )}
      {body}
    </Stack>
  );
}
