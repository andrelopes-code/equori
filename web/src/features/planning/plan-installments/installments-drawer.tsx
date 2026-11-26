import {
  Drawer,
  DrawerBody,
  DrawerClose,
  DrawerHeader,
  DrawerPanel,
  DrawerTitle,
} from "@slotted/react/drawer";
import { Stack } from "@slotted/react/stack";
import { Text } from "@slotted/react/typography";
import { useQuery } from "@tanstack/react-query";

import { useApi } from "@/api/api-context";
import type { components } from "@/api/schema.gen";
import { accountsQuery } from "@/features/accounts";
import type { PlanFormat } from "@/features/planning/budget-plan/use-plan-format";
import { InstallmentsTable } from "@/features/planning/plan-installments/installments-table";
import { useT } from "@/i18n/i18n-provider";

type Installment = components["schemas"]["BudgetPlanInstallment"];

interface InstallmentsDrawerProps {
  items: readonly Installment[];
  total: number;
  month: string;
  format: PlanFormat;
  onClose: () => void;
}

// What the month's statements bill of purchases made before the month: the accrual view counted
// each purchase whole in its own month, so no budget of this month covers them (A129).
export function InstallmentsDrawer({
  items,
  total,
  month,
  format,
  onClose,
}: InstallmentsDrawerProps) {
  const t = useT();
  const api = useApi();
  const accounts = useQuery(accountsQuery(api));

  const cards = new Map((accounts.data ?? []).map((a) => [a.id, a.name]));

  return (
    <Drawer
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      side="end"
      size="xl"
    >
      <DrawerPanel>
        <DrawerHeader>
          <DrawerTitle>
            {t("plan.installments.title", { month: format.month(month) })}
          </DrawerTitle>
          <DrawerClose />
        </DrawerHeader>
        <DrawerBody>
          <Stack gap={6}>
            <Text size="sm" tone="muted">
              {t("plan.installments.hint")}
            </Text>

            {items.length === 0 && (
              <Text size="sm" tone="muted">
                {t("plan.installments.empty")}
              </Text>
            )}

            {items.length > 0 && (
              <InstallmentsTable
                items={items}
                cards={cards}
                total={total}
                format={format}
              />
            )}
          </Stack>
        </DrawerBody>
      </DrawerPanel>
    </Drawer>
  );
}
