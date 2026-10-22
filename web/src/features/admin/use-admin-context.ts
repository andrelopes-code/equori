import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";

import { useApi } from "@/api/api-context";
import type { components } from "@/api/schema.gen";
import { adminQuery } from "@/features/admin/api";
import type { CellContext } from "@/features/admin/cell-text";
import type { Refs } from "@/features/admin/operations";
import { accountsQuery } from "@/features/accounts";
import { settingsQuery, useScale } from "@/features/setup";
import { useToday } from "@/i18n/today";

export interface Named {
  id: string;
  name: string;
}

function itemsOf(body: unknown): Named[] {
  if (typeof body !== "object" || body === null || !("items" in body)) {
    return [];
  }
  return (body as { items: Named[] }).items;
}

export interface AdminContext {
  cells: CellContext;
  refs: Refs;
  accounts: readonly components["schemas"]["Account"][];
  payees: readonly Named[];
  institutions: readonly Named[];
}

export function useAdminContext(): AdminContext {
  const api = useApi();
  const today = useToday();
  const accounts = useQuery(accountsQuery(api));
  const payees = useQuery(adminQuery(api, "/payees", { limit: "200" }));
  const institutions = useQuery(
    adminQuery(api, "/institutions", { limit: "200" }),
  );
  const settings = useQuery(settingsQuery(api));
  const scaleOf = useScale();

  return useMemo(() => {
    const list = accounts.data ?? [];
    const names = new Map<string, string>();
    for (const record of [
      ...list,
      ...itemsOf(payees.data),
      ...itemsOf(institutions.data),
    ]) {
      names.set(record.id, record.name);
    }
    const account = (kindOrClass: string) =>
      list.find((a) => a.kind === kindOrClass || a.class === kindOrClass)?.id ??
      "";
    return {
      cells: { names, scaleOf: scaleOf ?? (() => 0) },
      refs: {
        today,
        month: today.slice(0, 7),
        currency: settings.data?.base_currency ?? "",
        account,
      },
      accounts: list,
      payees: itemsOf(payees.data),
      institutions: itemsOf(institutions.data),
    };
  }, [
    accounts.data,
    payees.data,
    institutions.data,
    settings.data,
    scaleOf,
    today,
  ]);
}
