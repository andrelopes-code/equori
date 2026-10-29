import { Alert, AlertContent, AlertDescription } from "@slotted/react/alert";
import { Field, FieldLabel } from "@slotted/react/field";
import { Skeleton } from "@slotted/react/skeleton";
import { Stack } from "@slotted/react/stack";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableColumnHeader,
  TableContent,
  TableHead,
  TableRow,
} from "@slotted/react/table";
import { Text } from "@slotted/react/typography";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";

import { ProblemError } from "@/api/problem";
import { useApi } from "@/api/api-context";
import type { components } from "@/api/schema.gen";
import { accountsQuery } from "@/features/accounts";
import { returnQuery } from "@/features/portfolio/api";
import { accountLabel } from "@/features/portfolio/account-label";
import { PortfolioProblem } from "@/features/portfolio/portfolio-problem";
import {
  defaultFrom,
  periodProblem,
} from "@/features/portfolio/portfolio-period";
import type {
  PortfolioSearch,
  SearchPatch,
} from "@/features/portfolio/portfolio-search";
import { returnAccounts } from "@/features/portfolio/return-accounts";
import { instrumentsQuery, useScale } from "@/features/setup";
import { formatBasisPoints, formatDate } from "@/i18n/format";
import { useAppLocale, useT } from "@/i18n/i18n-provider";
import { useMoneyFormat } from "@/privacy/use-money-format";
import { ChoiceSelect } from "@/ui/choice-select";
import { DateInput } from "@/ui/date-input";
import { QueryError } from "@/ui/query-error";

type Money = components["schemas"]["Money"];

// The option that measures every brokerage tree; an account id never equals it.
const wholePortfolio = "portfolio";

// The money-weighted annual return of the whole portfolio or of one account tree over a period of at most 366 days; the
// period starts as the 12 months ending at the valuation date.
export function PortfolioReturn({
  date,
  valueIn,
  search,
  onChange,
}: {
  date: string;
  valueIn: string | undefined;
  search: PortfolioSearch;
  onChange: (patch: SearchPatch) => void;
}) {
  const t = useT();
  const [tag] = useAppLocale();
  const api = useApi();
  const fmt = useMoneyFormat();
  const scale = useScale();
  const accounts = useQuery(accountsQuery(api));
  const instruments = useQuery(instrumentsQuery(api));
  const options = useMemo(() => {
    if (accounts.data === undefined || instruments.data === undefined)
      return [];
    const byID = new Map(accounts.data.map((a) => [a.id, a]));
    const currencies = new Set(
      instruments.data.items
        .filter((i) => i.type === "currency")
        .map((i) => i.code),
    );
    const list = returnAccounts(
      accounts.data,
      currencies,
      (a) => accountLabel(byID, a.id),
      tag,
    ).map((a) => ({ value: a.id, label: accountLabel(byID, a.id) }));
    return accounts.data.some((a) => a.kind === "brokerage")
      ? [{ value: wholePortfolio, label: t("portfolio.return.whole") }, ...list]
      : list;
  }, [accounts.data, instruments.data, tag, t]);
  const to = search.to ?? date;
  const from = search.from ?? defaultFrom(to);
  const selected =
    options.find((o) => o.value === search.account)?.value ?? options[0]?.value;
  const accountID = selected === wholePortfolio ? null : selected;
  const problem = periodProblem(from, to);
  const report = useQuery(
    returnQuery(api, accountID, from, to, valueIn, problem === undefined),
  );
  const digits = (code: string) => scale?.(code) ?? 0;
  const money = (m: Money) => fmt.money(m, digits(m.currency));
  const loaded = accounts.data !== undefined && instruments.data !== undefined;
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
  else {
    const { annual_bp: rate, opening, closing, flows } = report.data;
    body = (
      <Stack gap={3}>
        <div role="group" aria-label={t("portfolio.return.title")}>
          <Stack gap={1}>
            <Text size="2xl" weight="semibold">
              {formatBasisPoints(rate, tag)}
            </Text>
            <Text size="sm" tone="muted">
              {[t("portfolio.return.opening"), money(opening)].join(": ")}
            </Text>
            <Text size="sm" tone="muted">
              {[t("portfolio.return.closing"), money(closing)].join(": ")}
            </Text>
          </Stack>
        </div>
        {flows.length === 0 ? (
          <Text size="sm" tone="muted">
            {t("portfolio.return.noFlows")}
          </Text>
        ) : (
          <Table columns={2} variant="framed">
            <TableContent>
              <TableCaption>{t("portfolio.return.flows")}</TableCaption>
              <TableHead>
                <TableRow>
                  <TableColumnHeader>
                    {t("portfolio.return.date")}
                  </TableColumnHeader>
                  <TableColumnHeader numeric>
                    {t("portfolio.return.amount")}
                  </TableColumnHeader>
                </TableRow>
              </TableHead>
              <TableBody>
                {flows.map((flow, index) => (
                  <TableRow key={`${flow.date}-${String(index)}`}>
                    <TableCell>{formatDate(flow.date, tag)}</TableCell>
                    <TableCell numeric>{money(flow.amount)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </TableContent>
          </Table>
        )}
      </Stack>
    );
  }
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
