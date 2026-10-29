import { Button } from "@slotted/react/button";
import {
  DashboardGrid,
  usePersistedDashboardLayout,
} from "@slotted/react/dashboard-grid";
import { Page, PageBody } from "@slotted/react/page";
import { Stack } from "@slotted/react/stack";
import {
  PageHeader,
  PageHeaderActions,
  PageHeaderHeading,
  PageHeaderSubheading,
  PageHeaderTitle,
  PageHeaderTitleArea,
  PageHeaderTitleRow,
} from "@slotted/react/page-header";
import { useState } from "react";

import { AttentionBlock } from "@/features/overview/attention-block";
import { BalanceChartBlock } from "@/features/overview/balance-chart-block";
import { BudgetsBlock } from "@/features/overview/budgets-block";
import { CardsBlock } from "@/features/overview/cards-block";
import { FirstStepsBlock } from "@/features/overview/first-steps-block";
import {
  DesktopFigure,
  type DesktopFigureKind,
} from "@/features/overview/desktop-figure";
import { GoalsBlock } from "@/features/overview/goals-block";
import { indicatorFigures } from "@/features/overview/indicator-figures";
import {
  MonthFlowFigure,
  type MonthFlowKind,
} from "@/features/overview/month-flow-figure";
import {
  NetWorthFigure,
  type NetWorthKind,
} from "@/features/overview/net-worth-figure";
import { placement } from "@/features/overview/overview-block";
import { SpendingBlock } from "@/features/overview/spending-block";
import { SpendingChart } from "@/features/overview/spending-chart";
import { UpcomingBlock } from "@/features/overview/upcoming-block";
import type { MessageKey } from "@/i18n/catalog.en";
import { useT } from "@/i18n/i18n-provider";
import { useToday } from "@/i18n/today";
import { useMediaQuery, wideQuery } from "@/ui/use-media-query";

const desk: [DesktopFigureKind, MessageKey][] = [
  ["net", "overview.figures.net"],
  ["result", "overview.figures.result"],
  ["balance", "overview.figures.balance"],
  ["committed", "overview.figures.committed"],
];
const worth: [NetWorthKind, MessageKey][] = [
  ["assets", "overview.netWorth.assets"],
  ["liabilities", "overview.netWorth.liabilities"],
  ["net", "overview.netWorth.title"],
];
const flows: [MonthFlowKind, MessageKey][] = [
  ["income", "overview.flows.income"],
  ["outflow", "overview.flows.outflow"],
  ["result", "overview.figures.result"],
];

// Per browser, as the privacy choice is kept (analytics design 5.2).
export const layoutKey = "equori.overview.layout";

// One grid of widgets the owner moves, resizes and hides. The grid stacks each column under its
// own widgets and places a widget with no stored cell in the first one free, in the order of the
// children: the widgets of one row share one height, so every row starts on one line. Below 1024 px the blocks stand in the
// order a phone reads them; the desk leads with the figures and the balance chart and keeps the
// attention list to a column beside it.
export function OverviewPage() {
  const t = useT();
  const month = useToday().slice(0, 7);
  const wide = useMediaQuery(wideQuery);
  const [editing, setEditing] = useState(false);
  const persisted = usePersistedDashboardLayout({ key: layoutKey });
  // The blocks both layouts draw, under one key each, so a block hidden at the desk is hidden on
  // the phone.
  const at = {
    attention: placement(
      "attention",
      t("overview.attention.title"),
      4,
      4,
      false,
    ),
    spending: placement("spending", t("overview.spending.title"), 4, 5),
    upcoming: placement("upcoming", t("overview.upcoming.title"), 4, 5),
    budgets: placement("budgets", t("overview.budgets.title"), 4, 5),
    cards: placement("cards", t("overview.cards.title"), 6, 4),
    goals: placement("goals", t("overview.goals.title"), 6, 4),
  };
  const indicators = indicatorFigures(month, t);
  return (
    <Page width="full">
      <PageHeader size="lg">
        <PageHeaderTitleArea>
          <PageHeaderTitleRow>
            <PageHeaderTitle>
              <PageHeaderHeading>{t("nav.overview")}</PageHeaderHeading>
              <PageHeaderSubheading>
                {t("overview.subtitle")}
              </PageHeaderSubheading>
            </PageHeaderTitle>
            {!editing && (
              <PageHeaderActions>
                <Button
                  variant="ghost"
                  onClick={() => {
                    setEditing(true);
                  }}
                >
                  {t("overview.block.edit")}
                </Button>
              </PageHeaderActions>
            )}
          </PageHeaderTitleRow>
        </PageHeaderTitleArea>
      </PageHeader>
      <PageBody>
        <Stack gap={6}>
          <FirstStepsBlock />

          <DashboardGrid
            aria-label={t("overview.block.label")}
            editing={editing}
            onEditingChange={setEditing}
            layout={persisted.layout}
            onLayoutChange={persisted.onLayoutChange}
          >
            {wide
              ? [
                  ...desk.map(([kind, key]) => (
                    <DesktopFigure
                      key={kind}
                      month={month}
                      kind={kind}
                      {...placement(`figure-${kind}`, t(key), 3, 2, false)}
                    />
                  )),
                  ...indicators,
                  <BalanceChartBlock
                    key="balance"
                    month={month}
                    {...placement(
                      "balance",
                      t("overview.balance.title"),
                      8,
                      4,
                      false,
                    )}
                  />,
                  <AttentionBlock
                    key="attention"
                    limit={4}
                    {...at.attention}
                  />,
                  <SpendingChart
                    key="spending"
                    month={month}
                    {...at.spending}
                  />,
                  <UpcomingBlock key="upcoming" {...at.upcoming} />,
                  <BudgetsBlock key="budgets" month={month} {...at.budgets} />,
                  <CardsBlock key="cards" {...at.cards} />,
                  <GoalsBlock key="goals" {...at.goals} />,
                ]
              : [
                  <AttentionBlock key="attention" {...at.attention} />,
                  ...worth.map(([kind, key]) => (
                    <NetWorthFigure
                      key={kind}
                      month={month}
                      kind={kind}
                      {...placement(kind, t(key), 4, 2)}
                    />
                  )),
                  ...indicators,
                  ...flows.map(([kind, key]) => (
                    <MonthFlowFigure
                      key={kind}
                      month={month}
                      kind={kind}
                      {...placement(`flow-${kind}`, t(key), 4, 2)}
                    />
                  )),
                  <SpendingBlock
                    key="spending"
                    month={month}
                    {...at.spending}
                  />,
                  <UpcomingBlock key="upcoming" {...at.upcoming} />,
                  <CardsBlock key="cards" {...at.cards} />,
                  <BudgetsBlock key="budgets" month={month} {...at.budgets} />,
                  <GoalsBlock key="goals" {...at.goals} />,
                ]}
          </DashboardGrid>
        </Stack>
      </PageBody>
    </Page>
  );
}
