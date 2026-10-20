import { useQuery } from "@tanstack/react-query";
import { Chart } from "@slotted/react/chart";
import { Grid } from "@slotted/react/grid";
import { Inline } from "@slotted/react/inline";
import { Segment, SegmentedControl } from "@slotted/react/segmented-control";
import { Stack } from "@slotted/react/stack";
import { Text } from "@slotted/react/typography";
import { useState } from "react";

import { useApi } from "@/api/api-context";
import type { components } from "@/api/schema.gen";
import { adminQuery } from "@/features/admin/api";
import {
  categoryPath,
  categoryRows,
  topCategories,
} from "@/features/admin/category-tree";
import { FigureTile } from "@/features/admin/figure-tile";
import { monthBounds } from "@/features/admin/month-bounds";
import { MonthSelect } from "@/features/admin/month-select";
import { OperationList } from "@/features/admin/operation-list";
import { operations } from "@/features/admin/operations";
import { QueryTable } from "@/features/admin/query-table";
import { RecordTable } from "@/features/admin/record-table";
import { actionText, conditionText } from "@/features/admin/rule-text";
import { TitledSection } from "@/features/admin/titled-section";
import type { AdminContext } from "@/features/admin/use-admin-context";
import { useDisplay } from "@/features/admin/use-display";
import { useT } from "@/i18n/i18n-provider";

type Statistics = components["schemas"]["CategorizationStatistics"];
type CategoryTotals = components["schemas"]["CategoryTotals"];
type Rule = components["schemas"]["Rule"];
type RuleSuggestion = components["schemas"]["RuleSuggestion"];
type SourceCategory = components["schemas"]["SourceCategory"];
type PayeeAlias = components["schemas"]["PayeeAlias"];
type CategoryClass = "expense" | "income";

// The tables read the same queries as the figures, so each list is fetched once.
const rulesList = ["/rules", { limit: "200" }] as const;
const pendingList = [
  "/rule-suggestions",
  { limit: "200", state: "pending" },
] as const;
const sourcesList = ["/source-categories", { limit: "200" }] as const;
const aliasesList = ["/payee-aliases", { limit: "200" }] as const;

function itemsOf<T>(body: unknown): T[] {
  return (body as { items?: T[] } | undefined)?.items ?? [];
}

const methods = ["rule", "source", "history", "manual"] as const;

export function CategorizationPanel({ ctx }: { ctx: AdminContext }) {
  const t = useT();
  const api = useApi();
  const show = useDisplay();
  const [month, setMonth] = useState(ctx.refs.month);
  const [categoryClass, setCategoryClass] = useState<CategoryClass>("expense");
  const bounds = monthBounds(month);
  const words = (rule: {
    conditions: Rule["conditions"];
    actions: Rule["actions"];
  }) => ({
    conditions: rule.conditions
      .map((c) => conditionText(c, ctx.cells))
      .join("; "),
    actions: rule.actions.map((a) => actionText(a, ctx.cells)).join("; "),
  });

  const statistics = useQuery(
    adminQuery(api, "/categorization-statistics", bounds),
  );
  const totals = useQuery(
    adminQuery(api, "/reports/categories", {
      ...bounds,
      class: categoryClass,
    }),
  );
  const rules = useQuery(adminQuery(api, ...rulesList));
  const pending = useQuery(adminQuery(api, ...pendingList));
  const sources = useQuery(adminQuery(api, ...sourcesList));

  const stats = statistics.data as Statistics | undefined;
  const ruleItems = itemsOf<Rule>(rules.data);
  const unmapped = itemsOf<SourceCategory>(sources.data).filter(
    (s) => s.category_id === undefined,
  );
  const totalItems = (totals.data as CategoryTotals | undefined)?.items ?? [];
  const top = topCategories(totalItems, ctx.accounts).filter(
    (row) => row.currency === ctx.refs.currency,
  );
  const money = (amount: number) =>
    show.money({ amount, currency: ctx.refs.currency });
  const categorized =
    stats === undefined ? 0 : stats.total - stats.uncategorized;
  const classLabel = t(`admin.categorization.class.${categoryClass}`);

  return (
    <Stack gap={8}>
      <Inline>
        <MonthSelect
          name="month"
          label={t("admin.month")}
          value={month}
          onChange={setMonth}
        />
      </Inline>

      <Grid gap={4} minItemWidth="sm">
        <FigureTile
          size="md"
          label={t("admin.categorization.coverage", {
            month: show.month(month),
          })}
          loading={statistics.isPending}
          // Counts, not money: a rounded share is exact enough for a figure.
          value={
            stats === undefined || stats.total === 0
              ? undefined
              : t("admin.categorization.percent", {
                  value: String(Math.round((categorized * 100) / stats.total)),
                })
          }
          comparison={
            stats === undefined
              ? undefined
              : t("admin.categorization.coverageDetail", {
                  count: String(categorized),
                  total: String(stats.total),
                })
          }
        />
        <FigureTile
          size="md"
          label={t("admin.categorization.uncategorized")}
          loading={statistics.isPending}
          value={stats === undefined ? undefined : String(stats.uncategorized)}
          comparison={t("admin.categorization.uncategorizedDetail")}
        />
        <FigureTile
          size="md"
          label={t("admin.categorization.enabledRules")}
          loading={rules.isPending}
          value={String(ruleItems.filter((r) => r.enabled).length)}
          comparison={t("admin.categorization.rulesDetail", {
            count: String(ruleItems.length),
          })}
        />
        <FigureTile
          size="md"
          label={t("admin.categorization.suggestions")}
          loading={pending.isPending}
          value={String(itemsOf<RuleSuggestion>(pending.data).length)}
        />
        <FigureTile
          size="md"
          label={t("admin.categorization.unmapped")}
          loading={sources.isPending}
          value={String(unmapped.length)}
          comparison={t("admin.categorization.unmappedDetail", {
            count: String(unmapped.reduce((sum, s) => sum + s.count, 0)),
          })}
        />
      </Grid>

      <Grid gap={4} minItemWidth="lg">
        <Chart
          variant="card"
          trigger="item"
          legendValues
          legendOverflow="wrap"
          loading={statistics.isPending}
          error={statistics.isError}
          data={
            stats === undefined || stats.total === 0
              ? []
              : [
                  ...methods.map((method) => ({
                    method: t(`admin.categorization.method.${method}`),
                    count: stats[method],
                  })),
                  {
                    method: t("admin.categorization.uncategorized"),
                    count: stats.uncategorized,
                  },
                ]
          }
          series={[
            {
              kind: "pie",
              field: "count",
              label: t("admin.categorization.transactions"),
              innerRadius: 0.64,
            },
          ]}
          title={t("admin.categorization.methods", {
            month: show.month(month),
          })}
          x={{ field: "method" }}
        />
        <Chart
          variant="card"
          orientation="horizontal"
          legend={false}
          loading={totals.isPending}
          error={totals.isError}
          data={top}
          series={[
            {
              kind: "bar",
              field: "amount",
              label: t("admin.categorization.amount"),
              labels: true,
            },
          ]}
          title={t("admin.categorization.top", { class: classLabel })}
          actions={
            <SegmentedControl
              size="sm"
              aria-label={t("admin.categorization.class")}
              value={categoryClass}
              onValueChange={(next) => {
                if (next === "expense" || next === "income") {
                  setCategoryClass(next);
                }
              }}
            >
              <Segment value="expense">
                {t("admin.categorization.class.expense")}
              </Segment>
              <Segment value="income">
                {t("admin.categorization.class.income")}
              </Segment>
            </SegmentedControl>
          }
          x={{ field: "category" }}
          y={{ format: money }}
        />
      </Grid>

      <TitledSection
        title={t("admin.categorization.byCategory", {
          class: classLabel,
          month: show.month(month),
        })}
      >
        {totals.data === undefined ? (
          <Text tone="muted">{t("admin.loading")}</Text>
        ) : (
          <RecordTable
            caption={t("admin.categorization.categoryTable")}
            rows={categoryRows(totalItems, ctx.accounts)}
            cells={ctx.cells}
          />
        )}
      </TitledSection>

      <TitledSection title={t("admin.categorization.rules")}>
        <Stack gap={6}>
          <QueryTable
            caption={t("admin.categorization.ruleTable")}
            path={rulesList[0]}
            query={rulesList[1]}
            cells={ctx.cells}
            pick={(body) =>
              itemsOf<Rule>(body)
                .sort((a, b) => a.priority - b.priority)
                .map((rule) => ({
                  priority: rule.priority,
                  name: rule.name,
                  enabled: rule.enabled,
                  ...words(rule),
                  stop_processing: rule.stop_processing,
                  categorized_count: rule.categorized_count,
                  last_categorized_at: rule.last_categorized_at,
                  id: rule.id,
                }))
            }
          />
          <QueryTable
            caption={t("admin.categorization.suggestionTable")}
            path={pendingList[0]}
            query={pendingList[1]}
            cells={ctx.cells}
            pick={(body) =>
              itemsOf<RuleSuggestion>(body).map((suggestion) => ({
                ...words(suggestion),
                examples: suggestion.example_transaction_ids.length,
                created_at: suggestion.created_at,
                id: suggestion.id,
              }))
            }
          />
        </Stack>
      </TitledSection>

      <TitledSection title={t("admin.categorization.mappings")}>
        <Stack gap={6}>
          <QueryTable
            caption={t("admin.categorization.sourceTable")}
            path={sourcesList[0]}
            query={sourcesList[1]}
            cells={ctx.cells}
            pick={(body) =>
              itemsOf<SourceCategory>(body)
                .sort(
                  (a, b) =>
                    Number(a.category_id !== undefined) -
                      Number(b.category_id !== undefined) || b.count - a.count,
                )
                .map((source) => ({
                  name: source.name,
                  count: source.count,
                  category:
                    source.category_id === undefined
                      ? t("admin.none")
                      : categoryPath(source.category_id, ctx.accounts),
                  provider: source.provider,
                  external_id: source.external_id,
                  id: source.id,
                }))
            }
          />
          <QueryTable
            caption={t("admin.categorization.aliasTable")}
            path={aliasesList[0]}
            query={aliasesList[1]}
            cells={ctx.cells}
            pick={(body) =>
              itemsOf<PayeeAlias>(body).map((alias) => ({
                pattern: alias.pattern,
                match_type: alias.match_type,
                payee: ctx.cells.names.get(alias.payee_id) ?? alias.payee_id,
                id: alias.id,
              }))
            }
          />
        </Stack>
      </TitledSection>

      <TitledSection title={t("admin.ops")}>
        <OperationList
          ops={operations.categorization}
          ctx={ctx}
          initial={bounds}
        />
      </TitledSection>
    </Stack>
  );
}
