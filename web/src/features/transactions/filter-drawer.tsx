import { Button } from "@slotted/react/button";
import { Checkbox } from "@slotted/react/checkbox";
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
import { Field, FieldLabel } from "@slotted/react/field";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@slotted/react/select";
import { Stack } from "@slotted/react/stack";
import { TextField } from "@slotted/react/text-field";

import type { components } from "@/api/schema.gen";
import { validateTransactionSearch } from "@/features/transactions/search";
import type { TransactionSearch } from "@/features/transactions/search";
import { useT } from "@/i18n/i18n-provider";

type Account = components["schemas"]["Account"];

interface FilterProps {
  search: TransactionSearch;
  accounts: Account[];
  onChange: (next: TransactionSearch) => void;
}

// A patch value that fails validation (empty text, an absent choice) removes the filter.
export function patchSearch(
  search: TransactionSearch,
  patch: Record<string, unknown>,
): TransactionSearch {
  return validateTransactionSearch({ ...search, ...patch });
}

export function FilterFields({ search, accounts, onChange }: FilterProps) {
  const t = useT();
  return (
    <>
      <Field>
        <FieldLabel>{t("transactions.filter.account")}</FieldLabel>
        <Select
          clearable
          value={search.account_id ?? null}
          items={accounts.map((a) => ({ value: a.id, label: a.name }))}
          onValueChange={(value) => {
            onChange(
              patchSearch(search, {
                account_id: typeof value === "string" ? value : undefined,
              }),
            );
          }}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {accounts.map((a) => (
              <SelectItem key={a.id} value={a.id}>
                {a.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
      <Field>
        <FieldLabel>{t("transactions.filter.from")}</FieldLabel>
        <TextField
          type="date"
          value={search.from ?? ""}
          onValueChange={(value) => {
            onChange(patchSearch(search, { from: value }));
          }}
        />
      </Field>
      <Field>
        <FieldLabel>{t("transactions.filter.to")}</FieldLabel>
        <TextField
          type="date"
          value={search.to ?? ""}
          onValueChange={(value) => {
            onChange(patchSearch(search, { to: value }));
          }}
        />
      </Field>
      <Checkbox
        checked={search.uncategorized === true}
        onCheckedChange={(checked) => {
          onChange(patchSearch(search, { uncategorized: checked }));
        }}
      >
        {t("transactions.filter.uncategorized")}
      </Checkbox>
    </>
  );
}

export function FilterDrawer(props: FilterProps) {
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
            <FilterFields {...props} />
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
