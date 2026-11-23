import { Inline } from "@slotted/react/inline";
import { Stack } from "@slotted/react/stack";
import { Table, TableBody, TableContent } from "@slotted/react/table";
import { Text } from "@slotted/react/typography";
import { useState } from "react";

import type { components } from "@/api/schema.gen";
import { changeText } from "@/features/instruments";
import { copyText } from "@/features/portfolio/contribution-plan/model/copy-text";
import { shareText } from "@/features/portfolio/contribution-plan/model/share-text";
import {
  contributionOf,
  positive,
  shoppingList,
} from "@/features/portfolio/contribution-plan/model/shopping-list";
import { CompareIndexersDialog } from "@/features/portfolio/contribution-plan/month/compare-indexers-dialog";
import { CopyListButton } from "@/features/portfolio/contribution-plan/month/copy-list-button";
import { CompanyReportDialog } from "@/features/portfolio/contribution-plan/month/company-report-dialog";
import { FundReportDialog } from "@/features/portfolio/contribution-plan/month/fund-report-dialog";
import { LeftoverRow } from "@/features/portfolio/contribution-plan/month/leftover-row";
import { PurchaseBar } from "@/features/portfolio/contribution-plan/month/purchase-bar";
import type { PurchaseSegment } from "@/features/portfolio/contribution-plan/month/purchase-bar";
import { PurchaseRow } from "@/features/portfolio/contribution-plan/month/purchase-row";
import { PurchaseTableHead } from "@/features/portfolio/contribution-plan/month/purchase-table-head";
import { useCompanyFigures } from "@/features/portfolio/contribution-plan/month/use-company-figures";
import { useCompareIndexers } from "@/features/portfolio/contribution-plan/month/use-compare-indexers";
import { useReportDialog } from "@/features/portfolio/contribution-plan/month/use-report-dialog";
import { useScale } from "@/features/setup";
import { useAppLocale, useT } from "@/i18n/i18n-provider";
import { useMoneyFormat } from "@/privacy/use-money-format";

type Plan = components["schemas"]["ContributionPlan"];
type Money = components["schemas"]["Money"];

interface PurchaseListProps {
  view: Plan;
  memberName: (ref: { account_id?: string; instrument?: string }) => string;
  // Enters edit mode with the assets of a group open.
  onSplit: (group: number) => void;
}

const leftoverKey = "leftover";

// The contribution as one bar and the purchases as its legend, largest cost first, the leftover
// last, and the plain-text copy of the list (spec, Purchase list as one bar).
export function PurchaseList({ view, memberName, onSplit }: PurchaseListProps) {
  const t = useT();
  const [locale] = useAppLocale();
  const fmt = useMoneyFormat();
  const scale = useScale();

  const [active, setActive] = useState<string>();

  const entries = shoppingList(view, memberName, scale ?? undefined);
  const leftover = positive(view.leftover) ? view.leftover : undefined;
  const base = contributionOf(entries, leftover);
  const compare = useCompareIndexers(base.currency);
  const report = useReportDialog();
  const statements = useReportDialog();
  const figures = useCompanyFigures(
    entries.flatMap((entry) => (entry.code === undefined ? [] : [entry.code])),
  );
  const money = (m: Money) => fmt.money(m, scale?.(m.currency) ?? 0);
  const shareOf = (m: Money) => shareText(m.amount / base.amount, locale);
  const profitOf = (code: string | undefined) => {
    const company = code === undefined ? undefined : figures.get(code);

    return company === undefined
      ? undefined
      : changeText(t, locale, company.profit);
  };
  const groupOf = (name: string, group: number) => {
    const groupName = view.classes[group]?.name;

    return groupName === name ? undefined : groupName;
  };
  const segments: PurchaseSegment[] = entries.map((entry) => ({
    key: entry.name,
    group: entry.group,
    amount: entry.cost.amount,
    label: `${entry.name} ${shareOf(entry.cost)}`,
  }));
  if (leftover !== undefined)
    segments.push({
      key: leftoverKey,
      amount: leftover.amount,
      label: `${t("contributionPlan.leftoverName")} ${shareOf(leftover)}`,
    });
  const text = copyText(entries, leftover, { t, locale, money });
  const withProfit = figures.size > 0;

  if (entries.length === 0) return null;

  return (
    <Stack gap={3}>
      <Inline align="center" justify="between" wrap="nowrap">
        <Text size="sm" weight="semibold" tone="muted">
          {t("contributionPlan.shopping")}
        </Text>

        <CopyListButton text={text} disabled={fmt.hidden} />
      </Inline>

      <PurchaseBar
        segments={segments}
        total={t("contributionPlan.purchaseBarEnd", { amount: money(base) })}
        active={active}
      />

      <div data-slotted-density="comfortable">
        <Table columns={withProfit ? 6 : 5} variant="ruled" edges="flush">
          <TableContent aria-label={t("contributionPlan.shopping")}>
            <PurchaseTableHead withProfit={withProfit} />

            <TableBody>
              {entries.map((entry) => (
                <PurchaseRow
                  key={entry.name}
                  entry={entry}
                  groupName={groupOf(entry.name, entry.group)}
                  base={base.amount}
                  withProfit={withProfit}
                  profit={profitOf(entry.code)}
                  onSplit={onSplit}
                  onCompare={compare.onCompare}
                  onReport={report.onReport}
                  onStatements={statements.onReport}
                  onPointer={setActive}
                />
              ))}

              {leftover !== undefined && (
                <LeftoverRow
                  rowKey={leftoverKey}
                  amount={leftover}
                  base={base.amount}
                  withProfit={withProfit}
                  onPointer={setActive}
                />
              )}
            </TableBody>
          </TableContent>
        </Table>
      </div>

      {compare.opened !== undefined && (
        <CompareIndexersDialog
          amount={compare.opened.cost}
          open
          onClose={compare.close}
        />
      )}

      {report.opened?.code !== undefined && (
        <FundReportDialog
          code={report.opened.code}
          quote={report.opened.cost.currency}
          open
          onClose={report.close}
        />
      )}

      {statements.opened?.code !== undefined && (
        <CompanyReportDialog
          code={statements.opened.code}
          open
          onClose={statements.close}
        />
      )}
    </Stack>
  );
}
