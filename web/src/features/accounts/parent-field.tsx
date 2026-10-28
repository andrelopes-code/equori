import { EntityPicker } from "@slotted/react/entity-picker";
import type { Entity } from "@slotted/core/entity-picker";
import { useMemo } from "react";

import type { components } from "@/api/schema.gen";
import {
  kindGroupLabel,
  kindGroups,
  kindTitle,
} from "@/features/accounts/account-kinds";
import { ParentOption } from "@/features/accounts/parent-option";
import { useT } from "@/i18n/i18n-provider";

type Account = components["schemas"]["Account"];

// The account another one stands inside, searchable by name, grouped like the kind chooser; an
// empty field leaves the account on its own line of the balance sheet.
export function ParentField({
  candidates,
  accounts,
  value,
  onChange,
  invalid,
}: {
  candidates: readonly Account[];
  // Every account, to count what each candidate already holds.
  accounts: readonly Account[];
  value: string | null;
  onChange: (id: string | null) => void;
  invalid: boolean;
}) {
  const t = useT();
  const byId = useMemo(
    () => new Map(candidates.map((a) => [a.id, a])),
    [candidates],
  );
  const holds = useMemo(() => {
    const count = new Map<string, number>();
    for (const a of accounts) {
      if (a.parent_id !== undefined && a.closed_on === undefined)
        count.set(a.parent_id, (count.get(a.parent_id) ?? 0) + 1);
    }
    return count;
  }, [accounts]);
  const items = useMemo(
    (): Entity[] =>
      candidates.map((a) => {
        const group = kindGroups.find(
          (g) => a.kind !== undefined && g.kinds.includes(a.kind),
        );
        const held = holds.get(a.id);
        return {
          id: a.id,
          label: a.name,
          ...(a.kind === undefined
            ? {}
            : { description: t(kindTitle[a.kind]) }),
          ...(held === undefined
            ? {}
            : { meta: t("accountForm.parentHolds", { count: held }) }),
          ...(group === undefined
            ? {}
            : { group: t(kindGroupLabel[group.key]) }),
        };
      }),
    [candidates, holds, t],
  );
  return (
    <EntityPicker
      items={items}
      value={value}
      openOn="focus"
      width="anchor"
      media="none"
      placeholder={t("accountForm.topLevel")}
      invalid={invalid}
      renderOption={(entity, state) => {
        const account = byId.get(entity.id);
        return account === undefined ? null : (
          <ParentOption
            account={account}
            kind={entity.description ?? ""}
            holds={entity.meta}
            query={state.query}
          />
        );
      }}
      onValueChange={(next) => {
        onChange(typeof next === "string" ? next : null);
      }}
    />
  );
}
