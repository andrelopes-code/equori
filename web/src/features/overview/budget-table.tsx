import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableColumnHeader,
  TableContent,
  TableHead,
  TableRow,
  TableRowHeader,
  TableSummary,
} from "@slotted/react/table";
import {
  Section,
  SectionBody,
  SectionHeader,
  SectionHeading,
  SectionTitle,
} from "@slotted/react/section";
import { Text } from "@slotted/react/typography";
import { VisuallyHidden } from "@slotted/react/visually-hidden";

import { budgetPace } from "@/features/overview/month-flows";
import styles from "@/features/overview/overview-page.module.css";
import type { Overview } from "@/features/overview/use-overview";
import { useT } from "@/i18n/i18n-provider";
import { BudgetBar } from "@/ui/budget-bar";
import { MoneyText } from "@/ui/money-text";

// The bar turns danger only when overspent; ahead of the month reads in the Left column.
const toneOf = { ok: "neutral", ahead: "neutral", over: "danger" } as const;

// Complete frontend O6: spent, budgeted and left per category, the pace on each bar.
export function BudgetTable({
  overview,
  scale,
}: {
  overview: Overview;
  scale: (currency: string) => number;
}) {
  const t = useT();
  const s = scale(overview.base);
  const money = (amount: number) => ({ amount, currency: overview.base });
  const lines = [...overview.budgets].sort((a, b) =>
    a.category.localeCompare(b.category),
  );
  const total = lines.reduce(
    (sum, line) => ({
      spent: sum.spent + line.spent,
      planned: sum.planned + line.planned,
      available: sum.available + line.available,
    }),
    { spent: 0, planned: 0, available: 0 },
  );
  return (
    <Section>
      <SectionHeader>
        <SectionTitle>
          <SectionHeading>{t("overview.budget")}</SectionHeading>
        </SectionTitle>
      </SectionHeader>
      <SectionBody>
        <div className={styles.block}>
          <Table columns={5}>
            <TableContent>
              <TableCaption>
                <VisuallyHidden>{t("overview.budget")}</VisuallyHidden>
              </TableCaption>
              <TableHead>
                <TableRow>
                  <TableColumnHeader>
                    {t("overview.budget.category")}
                  </TableColumnHeader>
                  <TableColumnHeader numeric>
                    {t("overview.budget.spent")}
                  </TableColumnHeader>
                  <TableColumnHeader numeric>
                    {t("overview.budget.planned")}
                  </TableColumnHeader>
                  <TableColumnHeader numeric>
                    {t("overview.budget.left")}
                  </TableColumnHeader>
                  <TableColumnHeader>
                    <VisuallyHidden>
                      {t("overview.budget.spent")}
                    </VisuallyHidden>
                  </TableColumnHeader>
                </TableRow>
              </TableHead>
              <TableBody>
                {lines.length === 0 && (
                  <TableRow>
                    <TableCell>
                      <Text size="sm" tone="muted">
                        {t("overview.budget.empty")}
                      </Text>
                    </TableCell>
                    <TableCell />
                    <TableCell />
                    <TableCell />
                    <TableCell />
                  </TableRow>
                )}
                {lines.map((line) => {
                  const pace = budgetPace({
                    spent: line.spent,
                    planned: line.planned,
                    elapsed: overview.elapsed,
                  });
                  return (
                    <TableRow key={line.id}>
                      <TableRowHeader>{line.category}</TableRowHeader>
                      <TableCell numeric text="nowrap">
                        <MoneyText
                          money={money(line.spent)}
                          scale={s}
                          symbol={false}
                        />
                      </TableCell>
                      <TableCell numeric text="nowrap">
                        <span className={styles.muted}>
                          <MoneyText
                            money={money(line.planned)}
                            scale={s}
                            symbol={false}
                          />
                        </span>
                      </TableCell>
                      <TableCell numeric text="nowrap">
                        <span data-pace={pace} className={styles.left}>
                          <MoneyText
                            money={money(line.available)}
                            scale={s}
                            symbol={false}
                          />
                        </span>
                      </TableCell>
                      <TableCell>
                        <BudgetBar
                          share={
                            line.planned > 0 ? line.spent / line.planned : 1
                          }
                          pace={overview.current ? overview.elapsed : undefined}
                          tone={toneOf[pace]}
                        />
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
              {lines.length > 0 && (
                <TableSummary>
                  <TableRow>
                    <TableRowHeader>
                      {t("overview.budget.total")}
                    </TableRowHeader>
                    <TableCell numeric text="nowrap">
                      <MoneyText
                        money={money(total.spent)}
                        scale={s}
                        symbol={false}
                      />
                    </TableCell>
                    <TableCell numeric text="nowrap">
                      <MoneyText
                        money={money(total.planned)}
                        scale={s}
                        symbol={false}
                      />
                    </TableCell>
                    <TableCell numeric text="nowrap">
                      <MoneyText
                        money={money(total.available)}
                        scale={s}
                        symbol={false}
                      />
                    </TableCell>
                    <TableCell />
                  </TableRow>
                </TableSummary>
              )}
            </TableContent>
          </Table>
          {overview.current && lines.length > 0 && (
            <Text size="xs" tone="muted">
              {t("overview.budget.note")}
            </Text>
          )}
        </div>
      </SectionBody>
    </Section>
  );
}
