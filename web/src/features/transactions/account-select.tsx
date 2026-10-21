import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@slotted/react/select";

import type { components } from "@/api/schema.gen";
import { useAppLocale } from "@/i18n/i18n-provider";

type Account = components["schemas"]["Account"];

// The open balance accounts — checking, savings, cards, wallets — by name.
export function AccountSelect({
  accounts,
  value,
  onChange,
  placeholder,
  exclude,
  invalid,
  name,
}: {
  accounts: readonly Account[];
  value: string | null;
  onChange: (id: string | null) => void;
  placeholder: string;
  exclude?: string | null;
  invalid?: boolean;
  name?: string;
}) {
  const [locale] = useAppLocale();
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
    <Select
      value={value}
      onValueChange={(next) => {
        onChange(typeof next === "string" ? next : null);
      }}
      {...(invalid === undefined ? {} : { invalid })}
      {...(name === undefined ? {} : { name })}
    >
      <SelectTrigger>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {items.map((a) => (
          <SelectItem key={a.id} value={a.id}>
            {a.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
