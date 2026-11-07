import { Button, ButtonLink } from "@slotted/react/button";
import {
  ColumnManager,
  ColumnManagerRoot,
  ColumnManagerTrigger,
} from "@slotted/react/column-manager";
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
import { Stack } from "@slotted/react/stack";
import { Text } from "@slotted/react/typography";
import { Link } from "@tanstack/react-router";
import { useMemo } from "react";

import type { components } from "@/api/schema.gen";
import { accountLabel } from "@/features/portfolio/account-label";
import { allocationLabel } from "@/features/portfolio/allocation-label";
import {
  defaultColumnState,
  holdingsColumns,
} from "@/features/portfolio/holdings-columns";
import { HoldingsGrid } from "@/features/portfolio/holdings-grid";
import {
  groupKey,
  orderedByGroup,
} from "@/features/portfolio/portfolio-holdings";
import type { Holding } from "@/features/portfolio/portfolio-holdings";
import type { AllocationBy } from "@/features/portfolio/portfolio-search";
import { useColumnState } from "@/features/portfolio/use-column-state";
import { useScale } from "@/features/setup";
import { useAppLocale, useT } from "@/i18n/i18n-provider";
import { useMoneyFormat } from "@/privacy/use-money-format";
import { AppLink } from "@/ui/app-link";

type Account = components["schemas"]["Account"];

interface HoldingsSectionProps {
  holdings: readonly Holding[];
  accounts: readonly Account[];
  institutions: ReadonlyMap<string, string>;
  by: AllocationBy;
  date: string;
  valueIn: string | undefined;
  unpriced: number;
  pending: boolean;
}

const storageKey = "equori.portfolio.columns";

// PC7, PC8: every row of the portfolio under its group, with what a reader records next.
export function HoldingsSection({
  holdings,
  accounts,
  institutions,
  by,
  date,
  valueIn,
  unpriced,
  pending,
}: HoldingsSectionProps) {
  const t = useT();
  const [tag] = useAppLocale();
  const fmt = useMoneyFormat();
  const scale = useScale();
  const [columnState, setColumnState] = useColumnState(
    storageKey,
    defaultColumnState,
  );

  const byID = useMemo(
    () => new Map(accounts.map((a) => [a.id, a])),
    [accounts],
  );
  const columns = useMemo(
    () =>
      holdingsColumns({
        t,
        fmt,
        tag,
        scale: scale ?? (() => 0),
        valueIn: valueIn ?? "",
      }),
    [t, fmt, tag, scale, valueIn],
  );
  const managed = useMemo(
    () => columns.filter((c) => c.id !== "group"),
    [columns],
  );
  const rows = useMemo(
    () =>
      orderedByGroup(holdings, by).map((h) => ({
        ...h,
        group: allocationLabel(t, by, groupKey(h, by), institutions),
        accountName: accountLabel(byID, h.accountID),
      })),
    [holdings, by, t, institutions, byID],
  );

  return (
    <Section size="lg">
      <SectionHeader>
        <SectionTitle>
          <SectionHeading>{t("holdings.list")}</SectionHeading>
          <SectionDescription>{t("holdings.list.note")}</SectionDescription>
        </SectionTitle>
        <SectionActions>
          <Inline gap={2} align="center">
            <ColumnManagerRoot>
              <ColumnManagerTrigger
                render={(props) => (
                  <Button {...props} variant="ghost" tone="secondary">
                    {t("holdings.columns")}
                  </Button>
                )}
              />
              <ColumnManager
                columns={managed}
                columnState={columnState}
                defaultColumnState={defaultColumnState}
                onColumnStateChange={setColumnState}
              />
            </ColumnManagerRoot>
            <ButtonLink
              variant="outline"
              tone="secondary"
              render={(props) => (
                <Link
                  {...props}
                  to="/transactions/new"
                  search={{ kind: "investment_income" }}
                />
              )}
            >
              {t("holdings.income.record")}
            </ButtonLink>
            <ButtonLink
              variant="outline"
              tone="secondary"
              render={(props) => (
                <Link
                  {...props}
                  to="/transactions/new"
                  search={{ kind: "trade" }}
                />
              )}
            >
              {t("holdings.trade")}
            </ButtonLink>
          </Inline>
        </SectionActions>
      </SectionHeader>
      <SectionBody>
        <Stack gap={3}>
          {unpriced > 0 && (
            <Inline gap={2} align="center">
              <Text size="sm" tone="muted">
                {t("portfolio.unvalued", { count: unpriced })}
              </Text>
              <AppLink to={{ to: "/instruments" }}>
                {t("holdings.prices")}
              </AppLink>
            </Inline>
          )}

          <HoldingsGrid
            label={t("holdings.list")}
            columns={columns}
            rows={rows}
            columnState={columnState}
            date={date}
            valueIn={valueIn ?? ""}
            accounts={byID}
            loading={pending}
            onColumnState={setColumnState}
          />
        </Stack>
      </SectionBody>
    </Section>
  );
}
