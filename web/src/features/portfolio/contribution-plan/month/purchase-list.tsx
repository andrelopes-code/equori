import { Inline } from "@slotted/react/inline";
import { Stack } from "@slotted/react/stack";
import {
  Table,
  TableBody,
  TableCell,
  TableContent,
  TableRow,
  TableRowHeader,
} from "@slotted/react/table";
import { Text } from "@slotted/react/typography";

import type { components } from "@/api/schema.gen";
import { CopyListButton } from "@/features/portfolio/contribution-plan/month/copy-list-button";
import { GroupDot } from "@/features/portfolio/contribution-plan/month/group-dot";
import { shoppingList } from "@/features/portfolio/contribution-plan/model/shopping-list";
import type { ShoppingEntry } from "@/features/portfolio/contribution-plan/model/shopping-list";
import { useScale } from "@/features/setup";
import { useT } from "@/i18n/i18n-provider";
import { useMoneyFormat } from "@/privacy/use-money-format";

type Plan = components["schemas"]["ContributionPlan"];
type Money = components["schemas"]["Money"];

interface PurchaseListProps {
  view: Plan;
  memberName: (ref: { account_id?: string; instrument?: string }) => string;
}

// One row per receiving entry, largest first, and the plain-text copy of the list.
export function PurchaseList({ view, memberName }: PurchaseListProps) {
  const t = useT();
  const fmt = useMoneyFormat();
  const scale = useScale();

  const entries = shoppingList(view, memberName);
  const money = (m: Money) => fmt.money(m, scale?.(m.currency) ?? 0);
  const units = (entry: ShoppingEntry) =>
    entry.quantity === undefined
      ? ""
      : t("contributionPlan.quantity", {
          count: fmt.number(
            { amount: entry.quantity, currency: entry.amount.currency },
            0,
          ),
        });
  const text = entries
    .map((entry) =>
      [entry.name, money(entry.amount), units(entry)]
        .filter((part) => part !== "")
        .join("  "),
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

      <Table columns={3} variant="plain">
        <TableContent aria-label={t("contributionPlan.shopping")}>
          <TableBody>
            {entries.map((entry) => (
              <TableRow key={entry.name} value={entry.name}>
                <TableRowHeader text="truncate">
                  <Inline gap={4} align="center" wrap="nowrap">
                    <GroupDot position={entry.group} />

                    {entry.name}
                  </Inline>
                </TableRowHeader>

                <TableCell numeric text="nowrap">
                  <Text size="xs" tone="muted">
                    {units(entry)}
                  </Text>
                </TableCell>

                <TableCell numeric text="nowrap">
                  <Text weight="semibold">{money(entry.amount)}</Text>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </TableContent>
      </Table>
    </Stack>
  );
}
