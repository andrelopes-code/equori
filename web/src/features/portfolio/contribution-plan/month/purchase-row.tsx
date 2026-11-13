import { Inline } from "@slotted/react/inline";
import { Link } from "@slotted/react/link";
import { TableCell, TableRow, TableRowHeader } from "@slotted/react/table";
import { Text } from "@slotted/react/typography";
import type { ComponentPropsWithRef } from "react";

import { GroupDot } from "@/features/portfolio/contribution-plan/month/group-dot";
import styles from "@/features/portfolio/contribution-plan/month/purchase-row.module.css";
import { quantityText } from "@/features/portfolio/contribution-plan/model/quantity-text";
import type { ShoppingEntry } from "@/features/portfolio/contribution-plan/model/shopping-list";
import { useScale } from "@/features/setup";
import { useAppLocale, useT } from "@/i18n/i18n-provider";
import { MASK } from "@/privacy/mask";
import { useMoneyFormat } from "@/privacy/use-money-format";

const separator = "·";

interface PurchaseRowProps {
  entry: ShoppingEntry;
  // Enters edit mode with the assets of the entry's group open.
  onSplit: (group: number) => void;
}

// A purchase: the name, then the units (or the link to split) in muted text and the cost, which
// ends on the vertical line of the other rows.
export function PurchaseRow({ entry, onSplit }: PurchaseRowProps) {
  const t = useT();
  const [locale] = useAppLocale();
  const fmt = useMoneyFormat();
  const scale = useScale();

  const units = unitsText(entry, fmt.hidden, locale);
  const cost = fmt.money(entry.cost, scale?.(entry.cost.currency) ?? 0);

  return (
    <TableRow value={entry.name}>
      <TableRowHeader text="truncate">
        <Inline gap={4} align="center" wrap="nowrap">
          <GroupDot position={entry.group} />

          {entry.name}
        </Inline>
      </TableRowHeader>

      <TableCell numeric text="nowrap">
        <Inline gap={3} align="center" justify="end" wrap="nowrap">
          {entry.splitToSee === true && (
            // Workaround for Slotted issue #97: Button has no text-sized variant, so a button
            // makes the row taller than its siblings; the link takes the row's text size.
            <Link
              size="xs"
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

          {units !== undefined && (
            <Text size="xs" tone="muted">
              {t("contributionPlan.quantity", { count: units })}
            </Text>
          )}

          {(units !== undefined || entry.splitToSee === true) && (
            <Text size="xs" tone="muted" aria-hidden="true">
              {separator}
            </Text>
          )}

          <Text weight="semibold">{cost}</Text>
        </Inline>
      </TableCell>
    </TableRow>
  );
}

function unitsText(
  entry: ShoppingEntry,
  hidden: boolean,
  locale: string,
): string | undefined {
  if (entry.quantity === undefined) return undefined;

  if (hidden) return MASK;

  return quantityText(entry.quantity, locale);
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
