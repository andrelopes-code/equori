import { Inline } from "@slotted/react/inline";
import { Link } from "@slotted/react/link";
import { TableCell, TableRow, TableRowHeader } from "@slotted/react/table";
import { Text } from "@slotted/react/typography";
import type { ComponentPropsWithRef } from "react";

import type { ShoppingEntry } from "@/features/portfolio/contribution-plan/model/shopping-list";
import { shareText } from "@/features/portfolio/contribution-plan/model/share-text";
import { GroupDot } from "@/features/portfolio/contribution-plan/month/group-dot";
import { orderText } from "@/features/portfolio/contribution-plan/month/order-text";
import styles from "@/features/portfolio/contribution-plan/month/purchase-row.module.css";
import { useScale } from "@/features/setup";
import { useAppLocale, useT } from "@/i18n/i18n-provider";
import { useMoneyFormat } from "@/privacy/use-money-format";

interface PurchaseRowProps {
  entry: ShoppingEntry;
  // The group of a member; nothing when the row is the group itself.
  groupName?: string | undefined;
  // The contribution in minor units: the base of the row's share.
  base: number;
  // Enters edit mode with the assets of the entry's group open.
  onSplit: (group: number) => void;
  // The key of the row under the pointer, or undefined when it leaves.
  onPointer: (key: string | undefined) => void;
}

// A purchase: swatch and name, group, order, cost and share of the contribution (spec, Purchase
// list as one bar).
export function PurchaseRow({
  entry,
  groupName,
  base,
  onSplit,
  onPointer,
}: PurchaseRowProps) {
  const t = useT();
  const [locale] = useAppLocale();
  const fmt = useMoneyFormat();
  const scale = useScale();

  const money = (m: ShoppingEntry["cost"]) =>
    fmt.money(m, scale?.(m.currency) ?? 0);
  const order = orderText(entry, { t, money, locale, hidden: fmt.hidden });
  const share = shareText(entry.cost.amount / base, locale);

  return (
    <TableRow
      value={entry.name}
      onMouseEnter={() => {
        onPointer(entry.name);
      }}
      onMouseLeave={() => {
        onPointer(undefined);
      }}
    >
      <TableRowHeader text="truncate">
        <Inline gap={4} align="center" wrap="nowrap">
          <GroupDot position={entry.group} shape="square" />

          {entry.name}
        </Inline>
      </TableRowHeader>

      <TableCell text="truncate">
        <Text size="sm" tone="muted">
          {groupName}
        </Text>
      </TableCell>

      <TableCell align="end" text="nowrap">
        {entry.splitToSee === true && (
          // Workaround for Slotted issue #97: Button has no text-sized variant, so a button
          // makes the row taller than its siblings; the link takes the row's text size.
          <Link
            size="sm"
            render={(props) => (
              <button
                {...buttonProps(props)}
                type="button"
                className={styles.action}
                onClick={() => {
                  onSplit(entry.group);
                }}
              />
            )}
          >
            {t("contributionPlan.splitToSee")}
          </Link>
        )}

        {order !== undefined && (
          <Text size="sm" tone="muted">
            {order}
          </Text>
        )}
      </TableCell>

      <TableCell numeric text="nowrap">
        <Text weight="semibold">{money(entry.cost)}</Text>
      </TableCell>

      <TableCell numeric text="nowrap">
        <Text size="sm" tone="muted">
          {share}
        </Text>
      </TableCell>
    </TableRow>
  );
}

// The anchor props of the link, less its href, for a button: the handlers and the ref differ
// only in the element type.
function buttonProps(
  props: ComponentPropsWithRef<"a">,
): ComponentPropsWithRef<"button"> {
  const rest = { ...props };
  delete rest.href;

  return rest as ComponentPropsWithRef<"button">;
}
