import { Inline } from "@slotted/react/inline";
import { Link } from "@slotted/react/link";
import { TableCell, TableRow, TableRowHeader } from "@slotted/react/table";
import { Text } from "@slotted/react/typography";

import { GroupDot } from "@/features/portfolio/contribution-plan/month/group-dot";
import { quantityText } from "@/features/portfolio/contribution-plan/model/quantity-text";
import type { ShoppingEntry } from "@/features/portfolio/contribution-plan/model/shopping-list";
import { useScale } from "@/features/setup";
import { useAppLocale, useT } from "@/i18n/i18n-provider";
import { MASK } from "@/privacy/mask";
import { useMoneyFormat } from "@/privacy/use-money-format";

const separator = "·";

interface PurchaseRowProps {
  entry: ShoppingEntry;
  // Enters edit mode, where a group splits its target among its assets.
  onEdit: () => void;
}

// A purchase: the name, then the units (or the link to split) in muted text and the cost, which
// ends on the vertical line of the other rows.
export function PurchaseRow({ entry, onEdit }: PurchaseRowProps) {
  const t = useT();
  const [locale] = useAppLocale();
  const fmt = useMoneyFormat();
  const scale = useScale();

  const units =
    entry.quantity === undefined
      ? undefined
      : fmt.hidden
        ? MASK
        : quantityText(entry.quantity, locale);
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
            <Text size="sm">
              <Link
                href="#"
                onClick={(event) => {
                  event.preventDefault();
                  onEdit();
                }}
              >
                {t("contributionPlan.splitToSee")}
              </Link>
            </Text>
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
