import { Inline } from "@slotted/react/inline";
import { Stack } from "@slotted/react/stack";
import {
  Table,
  TableBody,
  TableColumnHeader,
  TableContent,
  TableHead,
  TableRow,
} from "@slotted/react/table";
import { Text } from "@slotted/react/typography";
import { VisuallyHidden } from "@slotted/react/visually-hidden";
import { useState } from "react";

import type { components } from "@/api/schema.gen";
import { quantityText } from "@/features/portfolio/contribution-plan/model/quantity-text";
import { shareText } from "@/features/portfolio/contribution-plan/model/share-text";
import {
  contributionOf,
  positive,
  shoppingList,
} from "@/features/portfolio/contribution-plan/model/shopping-list";
import { CopyListButton } from "@/features/portfolio/contribution-plan/month/copy-list-button";
import { LeftoverRow } from "@/features/portfolio/contribution-plan/month/leftover-row";
import { PurchaseBar } from "@/features/portfolio/contribution-plan/month/purchase-bar";
import type { PurchaseSegment } from "@/features/portfolio/contribution-plan/month/purchase-bar";
import { PurchaseRow } from "@/features/portfolio/contribution-plan/month/purchase-row";
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
  const money = (m: Money) => fmt.money(m, scale?.(m.currency) ?? 0);
  const shareOf = (m: Money) => shareText(m.amount / base.amount, locale);
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
  const text = entries
    .map((entry) =>
      entry.quantity === undefined
        ? `${entry.name}  ${money(entry.cost)}`
        : `${entry.name}  ${t("contributionPlan.orderUnits", {
            count: quantityText(entry.quantity, locale),
            cost: money(entry.cost),
          })}`,
    )
    .concat(
      leftover === undefined
        ? []
        : [t("contributionPlan.leftover", { amount: money(leftover) })],
    )
    .join("\n");

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
        <Table columns={5} variant="ruled" edges="flush">
          <TableContent aria-label={t("contributionPlan.shopping")}>
            <TableHead>
              <TableRow>
                <TableColumnHeader>
                  <VisuallyHidden>
                    {t("contributionPlan.colAsset")}
                  </VisuallyHidden>
                </TableColumnHeader>

                <TableColumnHeader>
                  <VisuallyHidden>
                    {t("contributionPlan.colGroup")}
                  </VisuallyHidden>
                </TableColumnHeader>

                <TableColumnHeader align="end">
                  <Text size="xs" tone="muted" weight="medium">
                    {t("contributionPlan.colOrder")}
                  </Text>
                </TableColumnHeader>

                <TableColumnHeader numeric>
                  <Text size="xs" tone="muted" weight="medium">
                    {t("contributionPlan.colTotal")}
                  </Text>
                </TableColumnHeader>

                <TableColumnHeader numeric>
                  <Text size="xs" tone="muted" weight="medium">
                    {t("contributionPlan.colShare")}
                  </Text>
                </TableColumnHeader>
              </TableRow>
            </TableHead>

            <TableBody>
              {entries.map((entry) => (
                <PurchaseRow
                  key={entry.name}
                  entry={entry}
                  groupName={groupOf(entry.name, entry.group)}
                  base={base.amount}
                  onSplit={onSplit}
                  onPointer={setActive}
                />
              ))}

              {leftover !== undefined && (
                <LeftoverRow
                  rowKey={leftoverKey}
                  amount={leftover}
                  base={base.amount}
                  onPointer={setActive}
                />
              )}
            </TableBody>
          </TableContent>
        </Table>
      </div>
    </Stack>
  );
}
