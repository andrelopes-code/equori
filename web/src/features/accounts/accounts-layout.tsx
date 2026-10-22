import { Page } from "@slotted/react/page";
import { Outlet, useRouterState } from "@tanstack/react-router";
import { useMemo, useState } from "react";

import { AccountsHeader } from "@/features/accounts/accounts-header";
import type { AccountsTab } from "@/features/accounts/accounts-header";
import { AccountsHeaderSlots } from "@/features/accounts/accounts-header-slots";

function tabOf(pathname: string): AccountsTab {
  if (pathname.startsWith("/accounts/institutions")) return "institutions";
  if (pathname.startsWith("/accounts/links")) return "links";
  return "accounts";
}

// The accounts destination's three pages under one header: the header and its tabs stay mounted,
// so a tab change moves the indicator instead of drawing a new strip.
export function AccountsLayout() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [subheading, setSubheading] = useState<HTMLElement | null>(null);
  const [actions, setActions] = useState<HTMLElement | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const slots = useMemo(
    () => ({ subheading, actions, setRefreshing }),
    [subheading, actions],
  );
  return (
    <Page width="full">
      <AccountsHeader
        current={tabOf(pathname)}
        subheadingRef={setSubheading}
        actionsRef={setActions}
        refreshing={refreshing}
      />
      <AccountsHeaderSlots value={slots}>
        <Outlet />
      </AccountsHeaderSlots>
    </Page>
  );
}
