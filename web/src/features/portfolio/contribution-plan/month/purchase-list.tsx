import { Inline } from "@slotted/react/inline";
import { Stack } from "@slotted/react/stack";
import { Table, TableBody, TableContent } from "@slotted/react/table";
import { Text } from "@slotted/react/typography";

import type { components } from "@/api/schema.gen";
import { CopyListButton } from "@/features/portfolio/contribution-plan/month/copy-list-button";
import { PurchaseRow } from "@/features/portfolio/contribution-plan/month/purchase-row";
import { quantityText } from "@/features/portfolio/contribution-plan/model/quantity-text";
import {
  positive,
  shoppingList,
} from "@/features/portfolio/contribution-plan/model/shopping-list";
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

// One row per receiving entry, largest cost first, the leftover and the plain-text copy of the
// list.
export function PurchaseList({ view, memberName, onSplit }: PurchaseListProps) {
  const t = useT();
  const [locale] = useAppLocale();
  const fmt = useMoneyFormat();
  const scale = useScale();

  const entries = shoppingList(view, memberName, scale ?? undefined);
  const leftover = positive(view.leftover) ? view.leftover : undefined;
  const money = (m: Money) => fmt.money(m, scale?.(m.currency) ?? 0);
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

      <Table columns={2} variant="plain">
        <TableContent aria-label={t("contributionPlan.shopping")}>
          <TableBody>
            {entries.map((entry) => (
              <PurchaseRow key={entry.name} entry={entry} onSplit={onSplit} />
            ))}
          </TableBody>
        </TableContent>
      </Table>

      {leftover !== undefined && (
        <Inline justify="end">
          <Text size="sm" tone="muted">
            {t("contributionPlan.leftover", { amount: money(leftover) })}
          </Text>
        </Inline>
      )}
    </Stack>
  );
}
