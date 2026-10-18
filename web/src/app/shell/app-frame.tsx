import { useQuery } from "@tanstack/react-query";
import { Outlet, useRouterState } from "@tanstack/react-router";
import {
  AppShell,
  AppShellFooter,
  AppShellMain,
  AppShellNav,
  AppShellNavBody,
} from "@slotted/react/app-shell";
import { ToastRegion } from "@slotted/react/toast";
import { useEffect, useState } from "react";

import { useApi } from "@/api/api-context";
import { destinations } from "@/app/shell/destinations";
import { MoreSheet } from "@/app/shell/more-sheet";
import { SideNav } from "@/app/shell/side-nav";
import { accountsQuery } from "@/features/accounts";
import { useT } from "@/i18n/i18n-provider";
import { BottomBar } from "@/ui/bottom-bar";
import { IconGlyph } from "@/ui/icon-glyph";
import { useViewport } from "@/ui/use-viewport";

export function AppFrame() {
  const t = useT();
  const viewport = useViewport();
  const [moreOpen, setMoreOpen] = useState(false);

  useEffect(() => {
    document.documentElement.setAttribute(
      "data-slotted-density",
      viewport === "desktop" ? "compact" : "comfortable",
    );
  }, [viewport]);

  const [home, transactions, accounts] = destinations;
  // On the page of an open account the centre action opens the form with that account preselected.
  const routeAccountID = useRouterState({
    select: (s) => /^\/accounts\/([^/]+)$/.exec(s.location.pathname)?.[1],
  });
  const api = useApi();
  const accountList = useQuery({
    ...accountsQuery(api),
    enabled: routeAccountID !== undefined,
  });
  const accountID = accountList.data?.find(
    (a) => a.id === routeAccountID && a.closed_on === undefined,
  )?.id;

  return (
    <AppShell
      canvas={viewport === "phone" ? "flush" : "inset"}
      navMode="inline"
      navOpen={viewport === "desktop"}
      collapsedTo="rail"
      messages={{ nav: t("nav.label") }}
    >
      {viewport !== "phone" && (
        <AppShellNav>
          <AppShellNavBody>
            <SideNav
              mode={viewport === "desktop" ? "expanded" : "compact"}
              onMore={() => {
                setMoreOpen(true);
              }}
            />
          </AppShellNavBody>
        </AppShellNav>
      )}
      <AppShellMain>
        <Outlet />
      </AppShellMain>
      {viewport === "phone" && home && transactions && accounts && (
        <AppShellFooter>
          <BottomBar
            items={[
              {
                key: home.key,
                label: t(home.label),
                icon: home.icon,
                to: home.to,
              },
              {
                key: transactions.key,
                label: t(transactions.label),
                icon: transactions.icon,
                to: transactions.to,
              },
              {
                key: "new",
                label: t("nav.new"),
                icon: <IconGlyph name="plus" />,
                to: "/transactions/new",
                ...(accountID === undefined
                  ? {}
                  : { search: { account_id: accountID } }),
                emphasized: true,
              },
              {
                key: accounts.key,
                label: t(accounts.label),
                icon: accounts.icon,
                to: accounts.to,
              },
              {
                key: "more",
                label: t("nav.more"),
                icon: <IconGlyph name="more" />,
                onPress: () => {
                  setMoreOpen(true);
                },
              },
            ]}
          />
        </AppShellFooter>
      )}
      <ToastRegion />
      <MoreSheet open={moreOpen} onOpenChange={setMoreOpen} />
    </AppShell>
  );
}
