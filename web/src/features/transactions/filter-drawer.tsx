import { Button } from "@slotted/react/button";
import {
  Drawer,
  DrawerBody,
  DrawerClose,
  DrawerFooter,
  DrawerHeader,
  DrawerPanel,
  DrawerTitle,
  DrawerTrigger,
} from "@slotted/react/drawer";
import { Stack } from "@slotted/react/stack";

import { FilterFields } from "@/features/transactions/filter-fields";
import type { TransactionSearch } from "@/features/transactions/search";
import { useT } from "@/i18n/i18n-provider";

export function FilterDrawer({
  search,
  onChange,
}: {
  search: TransactionSearch;
  onChange: (next: TransactionSearch) => void;
}) {
  const t = useT();
  return (
    <Drawer side="bottom">
      <DrawerTrigger
        render={(triggerProps) => (
          <Button {...triggerProps} tone="secondary" variant="outline">
            {t("transactions.filters")}
          </Button>
        )}
      />
      <DrawerPanel>
        <DrawerHeader>
          <DrawerTitle>{t("transactions.filters")}</DrawerTitle>
          <DrawerClose />
        </DrawerHeader>
        <DrawerBody>
          <Stack gap={4}>
            <FilterFields search={search} onChange={onChange} />
          </Stack>
        </DrawerBody>
        <DrawerFooter>
          <DrawerClose
            render={(closeProps) => (
              <Button
                {...closeProps}
                aria-label={t("transactions.filters.done")}
              >
                {t("transactions.filters.done")}
              </Button>
            )}
          />
        </DrawerFooter>
      </DrawerPanel>
    </Drawer>
  );
}
