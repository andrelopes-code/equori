import { Alert, AlertContent, AlertDescription } from "@slotted/react/alert";
import { Button } from "@slotted/react/button";
import { Card, CardActions, CardBody, CardHeader } from "@slotted/react/card";
import { Field, FieldLabel } from "@slotted/react/field";
import { Inline } from "@slotted/react/inline";
import { Stack } from "@slotted/react/stack";
import { TextField } from "@slotted/react/text-field";
import { Text } from "@slotted/react/typography";
import { useQuery } from "@tanstack/react-query";

import { useApi } from "@/api/api-context";
import { accountsQuery, balancesQuery } from "@/features/accounts";
import { AmountField } from "@/features/calculators/amount-field";
import { CalcTable } from "@/features/calculators/calc-table";
import styles from "@/features/calculators/calculators.module.css";
import { CalculatorFrame } from "@/features/calculators/calculator-frame";
import { CalculatorMethod } from "@/features/calculators/calculator-method";
import {
  readMinor,
  readRate,
  useCalculatorSearch,
} from "@/features/calculators/calculator-search";
import { ChoiceField } from "@/features/calculators/choice-field";
import { payoffPlan } from "@/features/calculators/debt-math";
import type { Debt, PayoffPlan } from "@/features/calculators/debt-math";
import {
  decodeDebts,
  encodeDebts,
  maxDebts,
} from "@/features/calculators/debt-rows";
import type { DebtRow } from "@/features/calculators/debt-rows";
import {
  debtRateQuote,
  monthlyDebtRate,
} from "@/features/calculators/debt-region";
import { FilledNote } from "@/features/calculators/filled-note";
import type { Source } from "@/features/calculators/method-section";
import { RateField } from "@/features/calculators/rate-field";
import { ResultLead } from "@/features/calculators/result-lead";
import { useCalculatorMoney } from "@/features/calculators/use-calculator-money";
import { formatDate } from "@/i18n/format";
import { useAppLocale, useAppLocaleState, useT } from "@/i18n/i18n-provider";
import { useToday } from "@/i18n/today";

const sources: Source[] = [
  {
    title:
      "Kellogg School of Management, The Snowball Approach to Debt (Gal and McShane 2012)",
    url: "https://www.kellogg.northwestern.edu/news_articles/2012/snowball-approach.aspx",
  },
];

const debtKinds = new Set(["loan", "credit_card"]);

// Design §5, debt-payoff: the avalanche and the snowball side by side over the same debts and
// budget, with the month each debt closes (study §3.3, E3).
export function DebtPayoffCalculator() {
  const t = useT();
  const [locale] = useAppLocale();
  const { locale: profile } = useAppLocaleState();
  const api = useApi();
  const today = useToday();
  const money = useCalculatorMoney();
  const [search, set] = useCalculatorSearch();
  const accounts = useQuery(accountsQuery(api)).data;
  const balances = useQuery(balancesQuery(api, today, "booked")).data;
  if (money === null)
    return (
      <CalculatorFrame
        id="debt-payoff"
        inputs={null}
        results={null}
        method={null}
      />
    );

  // What each loan and card of the base currency owes today: a liability's balance is negative.
  const owed = new Map<string, { name: string; amount: number }>();
  for (const a of accounts ?? []) {
    if (
      a.class !== "liability" ||
      a.kind === undefined ||
      !debtKinds.has(a.kind)
    )
      continue;
    const b = balances?.find((x) => x.account_id === a.id)?.balance;
    if (b?.currency === money.currency && b.amount < 0)
      owed.set(a.id, { name: a.name, amount: -b.amount });
  }
  const filled: DebtRow[] = [...owed].slice(0, maxDebts).map(([id, o]) => ({
    name: o.name,
    balance: String(o.amount),
    rate: "",
    minimum: "",
    account: id,
  }));
  const rows =
    search.debts === undefined ? filled : (decodeDebts(search.debts) ?? []);
  const setRows = (next: readonly DebtRow[]) => {
    set({ debts: encodeDebts(next) });
  };
  const update = (i: number, patch: Partial<DebtRow>) => {
    setRows(rows.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  };

  const quote = debtRateQuote(profile.region);
  const period =
    search.ratePeriod === "month" || search.ratePeriod === "year"
      ? search.ratePeriod
      : quote.period;
  const budget = readMinor(search.budget);
  const debts: Debt[] = [];
  for (const r of rows) {
    const balance = readMinor(r.balance);
    const rate = readRate(r.rate);
    const minimum = readMinor(r.minimum);
    if (balance === null || rate === null || rate < 0 || minimum === null)
      break;
    debts.push({
      name: r.name,
      balance,
      rate: monthlyDebtRate(rate, period, quote.nominal),
      minimum,
    });
  }

  let results = null;
  if (budget !== null && debts.length > 0 && debts.length === rows.length) {
    const avalanche = payoffPlan(debts, budget, "avalanche");
    const snowball = payoffPlan(debts, budget, "snowball");
    if (avalanche === "below_minimums" || snowball === "below_minimums")
      results = (
        <Alert tone="warning">
          <AlertContent>
            <AlertDescription>{t("calc.debt.belowMinimums")}</AlertDescription>
          </AlertContent>
        </Alert>
      );
    else {
      const plans = [avalanche, snowball];
      const cell = (pick: (p: PayoffPlan) => string) =>
        plans.map((p) =>
          p === "not_closed" ? t("calc.debt.notClosedCell") : pick(p),
        );
      const rowsOf = [
        {
          key: "months",
          cells: [t("calc.debt.months"), ...cell((p) => String(p.months))],
        },
        {
          key: "interest",
          cells: [
            t("calc.debt.interest"),
            ...cell((p) => money.format(p.interest)),
          ],
        },
        ...debts.map((d, i) => ({
          key: `close-${String(i)}`,
          cells: [
            t("calc.debt.closes", { name: d.name }),
            ...cell((p) =>
              String(p.closed.find((c) => c.name === d.name)?.month ?? ""),
            ),
          ],
        })),
      ];
      const a = avalanche === "not_closed" ? null : avalanche;
      const s = snowball === "not_closed" ? null : snowball;
      results = (
        <Stack gap={5}>
          {(a === null || s === null) && (
            <Alert tone="warning">
              <AlertContent>
                <AlertDescription>{t("calc.debt.notClosed")}</AlertDescription>
              </AlertContent>
            </Alert>
          )}
          {a !== null && s !== null && (
            // A comparison states which order is lower and by how much (design §2).
            <ResultLead
              label={t(
                a.interest < s.interest
                  ? "calc.debt.avalancheLower"
                  : a.interest > s.interest
                    ? "calc.debt.snowballLower"
                    : "calc.debt.sameInterest",
              )}
              value={money.format(Math.abs(a.interest - s.interest))}
              summary={t("calc.debt.summary", {
                avalanche: a.months,
                snowball: s.months,
              })}
            />
          )}
          <CalcTable
            caption={t("calc.debt.compare")}
            headers={[
              t("calc.debt.figure"),
              t("calc.debt.avalanche"),
              t("calc.debt.snowball"),
            ]}
            rows={rowsOf}
          />
        </Stack>
      );
    }
  }

  const inputs = (
    <>
      <AmountField
        label={t("calc.debt.budget")}
        hint={t("calc.debt.budget.hint")}
        value={search.budget}
        money={money}
        onChange={(v) => {
          set({ budget: v });
        }}
      />
      <ChoiceField
        label={t("calc.debt.ratePeriod")}
        {...(period === "year"
          ? {
              hint: t(
                quote.nominal
                  ? "calc.debt.ratePeriod.nominal"
                  : "calc.debt.ratePeriod.effective",
              ),
            }
          : {})}
        choices={[
          { value: "month", label: t("calc.period.month") },
          { value: "year", label: t("calc.period.year") },
        ]}
        value={period}
        onChange={(next) => {
          set({ ratePeriod: next === quote.period ? undefined : next });
        }}
      />
      {rows.map((r, i) => {
        const n = i + 1;
        const source =
          r.account === undefined ? undefined : owed.get(r.account);
        return (
          // A row's position is its identity: the rows have no other key.
          <Card key={i} fill="subtle" size="sm">
            <CardHeader>
              <Text size="sm" weight="semibold">
                {t("calc.debt.row", { n })}
              </Text>
              <CardActions>
                <Button
                  size="sm"
                  variant="ghost"
                  tone="secondary"
                  onClick={() => {
                    setRows(rows.filter((_, j) => j !== i));
                  }}
                >
                  {t("calc.debt.remove", { n })}
                </Button>
              </CardActions>
            </CardHeader>
            <CardBody>
              <div className={styles.pair}>
                <Field>
                  <FieldLabel>{t("calc.debt.name", { n })}</FieldLabel>
                  <TextField
                    name={`debt-${String(n)}-name`}
                    value={r.name}
                    onChange={(event) => {
                      update(i, { name: event.target.value });
                    }}
                  />
                </Field>
                <AmountField
                  label={t("calc.debt.balance", { n })}
                  value={r.balance === "" ? undefined : r.balance}
                  money={money}
                  onChange={(v) => {
                    update(i, { balance: v ?? "", account: undefined });
                  }}
                >
                  {source !== undefined && (
                    <FilledNote
                      origin={t("calc.debt.origin", {
                        account: source.name,
                        date: formatDate(today, locale),
                      })}
                    />
                  )}
                </AmountField>
                <RateField
                  label={t("calc.debt.rate", { n })}
                  name={`debt-${String(n)}-rate`}
                  value={r.rate}
                  onChange={(v) => {
                    update(i, { rate: v });
                  }}
                />
                <AmountField
                  label={t("calc.debt.minimum", { n })}
                  value={r.minimum === "" ? undefined : r.minimum}
                  money={money}
                  onChange={(v) => {
                    update(i, { minimum: v ?? "" });
                  }}
                />
              </div>
            </CardBody>
          </Card>
        );
      })}
      {rows.length < maxDebts && (
        <Inline>
          <Button
            variant="outline"
            tone="secondary"
            onClick={() => {
              setRows([
                ...rows,
                {
                  name: "",
                  balance: "",
                  rate: "",
                  minimum: "",
                  account: undefined,
                },
              ]);
            }}
          >
            {t("calc.debt.add")}
          </Button>
        </Inline>
      )}
    </>
  );

  return (
    <CalculatorFrame
      id="debt-payoff"
      inputs={inputs}
      results={results}
      method={<CalculatorMethod id="debt-payoff" sources={sources} />}
    />
  );
}
