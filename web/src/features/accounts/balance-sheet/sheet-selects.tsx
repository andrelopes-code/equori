import { Stack } from "@slotted/react/stack";
import { Text } from "@slotted/react/typography";

import type {
  GroupBy,
  Order,
} from "@/features/accounts/balance-sheet/sheet-layout";
import styles from "@/features/accounts/balance-sheet/sheet-selects.module.css";
import { useT } from "@/i18n/i18n-provider";
import { ChoiceSelect } from "@/ui/form-fields/choice-select";

interface SheetSelectsProps {
  group: GroupBy;
  order: Order;
  onGroupChange: (group: GroupBy) => void;
  onOrderChange: (order: Order) => void;
}

// The grouping and the order of the list on a phone: two selects side by side, each under its
// words, so the controls take one row above the records (M2).
export function SheetSelects({
  group,
  order,
  onGroupChange,
  onOrderChange,
}: SheetSelectsProps) {
  const t = useT();

  return (
    <div className={styles.row}>
      <Stack gap={1}>
        <Text size="xs" tone="muted">
          {t("balanceSheet.groupBy")}
        </Text>
        <ChoiceSelect
          label={t("balanceSheet.groupBy")}
          multiple={false}
          value={group}
          choices={[
            { value: "kind", label: t("balanceSheet.groupKind") },
            { value: "institution", label: t("balanceSheet.groupInstitution") },
            { value: "none", label: t("balanceSheet.groupNone") },
          ]}
          onChange={(value) => {
            if (
              value === "kind" ||
              value === "institution" ||
              value === "none"
            ) {
              onGroupChange(value);
            }
          }}
        />
      </Stack>

      <Stack gap={1}>
        <Text size="xs" tone="muted">
          {t("balanceSheet.order")}
        </Text>
        <ChoiceSelect
          label={t("balanceSheet.order")}
          multiple={false}
          value={order}
          choices={[
            { value: "balance", label: t("balanceSheet.orderBalance") },
            { value: "name", label: t("balanceSheet.orderName") },
            { value: "attention", label: t("balanceSheet.orderAttention") },
          ]}
          onChange={(value) => {
            if (
              value === "balance" ||
              value === "name" ||
              value === "attention"
            ) {
              onOrderChange(value);
            }
          }}
        />
      </Stack>
    </div>
  );
}
