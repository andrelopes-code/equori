import type { Entity } from "@slotted/core/entity-picker";
import { EntityPicker } from "@slotted/react/entity-picker";
import { Highlight } from "@slotted/react/highlight";
import { Inline } from "@slotted/react/inline";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";

import { useApi } from "@/api/api-context";
import { accountsQuery } from "@/features/accounts";
import { useCreateCategory } from "@/features/categories/api";
import { CategoryMark } from "@/features/categories/category-mark";
import {
  categoryEntries,
  orderForAmount,
} from "@/features/categories/category-paths";
import type { CategoryEntry } from "@/features/categories/category-paths";
import {
  readRecentCategories,
  rememberCategory,
} from "@/features/categories/recent-categories";
import { settingsQuery } from "@/features/setup";
import { useAppLocale, useT } from "@/i18n/i18n-provider";

export interface CategoryPickerProps {
  value: string | null;
  onChange: (id: string | null) => void;
  // The amount the category receives; its sign puts expense or income first.
  amount?: number;
  "aria-label"?: string;
  name?: string;
  size?: "sm" | "md" | "lg";
  variant?: "outline" | "subtle" | "plain";
  autoFocus?: boolean;
  defaultOpen?: boolean;
  invalid?: boolean;
  disabled?: boolean;
  // False keeps the list inside a layer the picker already stands in.
  portal?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function CategoryPicker({
  value,
  onChange,
  amount = -1,
  onOpenChange,
  ...rest
}: CategoryPickerProps) {
  const t = useT();
  const [locale] = useAppLocale();
  const api = useApi();
  const accounts = useQuery(accountsQuery(api));
  const settings = useQuery(settingsQuery(api));
  const create = useCreateCategory();
  const [recentIds, setRecentIds] = useState(readRecentCategories);

  const entries = useMemo(
    () => categoryEntries(accounts.data ?? [], locale),
    [accounts.data, locale],
  );
  const byId = useMemo(() => new Map(entries.map((e) => [e.id, e])), [entries]);
  const groups = {
    expense: t("category.group.expense"),
    income: t("category.group.income"),
  };
  const toEntity = (entry: CategoryEntry): Entity => ({
    id: entry.id,
    label: entry.path,
    group: groups[entry.class],
    avatar: null,
  });
  const items = orderForAmount(entries, amount).map(toEntity);
  // The chosen category stays known even when archived, so the field shows its name.
  const chosen = value === null ? undefined : byId.get(value);
  const known = chosen === undefined ? [] : [toEntity(chosen)];
  const recent = recentIds.flatMap((id) => {
    const entry = byId.get(id);
    return entry === undefined || entry.archived || entry.uncategorized
      ? []
      : [{ ...toEntity(entry), group: undefined }];
  });

  const createClass = amount > 0 ? "income" : "expense";
  const baseCurrency = settings.data?.base_currency;

  return (
    <EntityPicker
      {...rest}
      items={items}
      entities={known}
      recent={recent}
      media="none"
      openOn="focus"
      value={value}
      onOpenChange={(open) => onOpenChange?.(open)}
      onValueChange={(next) => {
        if (next !== null) {
          rememberCategory(next);
          setRecentIds(readRecentCategories());
        }
        onChange(next);
      }}
      onCreate={
        baseCurrency === undefined
          ? undefined
          : async (query) => {
              const created = await create.mutateAsync({
                name: query.trim(),
                class: createClass,
                currency: baseCurrency,
              });
              return {
                id: created.id,
                label: created.name,
                group: groups[createClass],
                avatar: null,
              };
            }
      }
      messages={{ create: t("category.create") }}
      renderOption={(entity, state) => {
        const entry = byId.get(entity.id);
        return (
          <Inline gap={3} align="center" wrap="nowrap">
            <CategoryMark
              name={entry?.name ?? entity.label}
              color={entry?.color}
              icon={entry?.icon}
            />
            <Highlight
              text={entity.label}
              query={state.query}
              locale={locale}
            />
          </Inline>
        );
      }}
    />
  );
}
