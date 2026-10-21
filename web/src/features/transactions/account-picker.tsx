import { useField } from "@slotted/react/field";
import { Text } from "@slotted/react/typography";
import { useEffect } from "react";

import type { components } from "@/api/schema.gen";
import { CategoryMark } from "@/features/categories";
import styles from "@/features/transactions/account-picker.module.css";
import type { MessageKey } from "@/i18n/catalog.en";
import { useAppLocale, useT } from "@/i18n/i18n-provider";

type Account = components["schemas"]["Account"];

// Families read: select, radio-group, toggle-group. A household has a handful of balance
// accounts and picks one on every entry; a select hides them behind a press and draws them as
// names alone. The open accounts stand as tiles — mark, name and kind — over native radios,
// which give the group its name, its arrow keys and its single tab stop.
export function AccountPicker({
  accounts,
  value,
  onChange,
  exclude,
  name,
}: {
  accounts: readonly Account[];
  value: string | null;
  onChange: (id: string) => void;
  exclude?: string | null;
  // The radio group's name; two pickers on one form need two.
  name: string;
}) {
  const t = useT();
  const [locale] = useAppLocale();
  const field = useField();
  const register = field?.registerControl;
  useEffect(() => {
    register?.();
  }, [register]);
  const collator = new Intl.Collator(locale, { sensitivity: "base" });
  const items = accounts
    .filter(
      (a) =>
        (a.class === "asset" || a.class === "liability") &&
        a.system_role === undefined &&
        (a.closed_on === undefined || a.id === value) &&
        a.id !== exclude,
    )
    .sort((a, b) => collator.compare(a.name, b.name));
  return (
    <div
      role="radiogroup"
      aria-labelledby={field?.ids.label}
      aria-describedby={field?.describedBy}
      aria-invalid={field?.invalid === true ? true : undefined}
      className={styles.tiles}
    >
      {items.map((account) => (
        <label key={account.id} className={styles.tile}>
          <input
            type="radio"
            name={name}
            value={account.id}
            className={styles.radio}
            checked={account.id === value}
            onChange={() => {
              onChange(account.id);
            }}
          />
          <CategoryMark
            name={account.name}
            color={account.color}
            icon={account.icon}
            size="md"
          />
          <span className={styles.text}>
            <Text weight="medium" className={styles.cut}>
              {account.name}
            </Text>
            {account.kind !== undefined && (
              <Text size="sm" tone="muted" className={styles.cut}>
                {t(`kind.${account.kind}` as MessageKey)}
              </Text>
            )}
          </span>
        </label>
      ))}
    </div>
  );
}
