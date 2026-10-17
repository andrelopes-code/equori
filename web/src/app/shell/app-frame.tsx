import { Outlet } from "@tanstack/react-router";
import {
  AppShell,
  AppShellFooter,
  AppShellMain,
  AppShellNav,
  AppShellNavBody,
} from "@slotted/react/app-shell";
import { useEffect, useState } from "react";

import { destinations } from "@/app/shell/destinations";
import { MoreSheet } from "@/app/shell/more-sheet";
import { SideNav } from "@/app/shell/side-nav";
import { useT } from "@/i18n/i18n-provider";
import { BottomBar } from "@/ui/bottom-bar";
import { MoreIcon, PlusIcon } from "@/ui/icons";
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

  return (
    <AppShell
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
                icon: <PlusIcon />,
                to: "/transactions/new",
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
                icon: <MoreIcon />,
                onPress: () => {
                  setMoreOpen(true);
                },
              },
            ]}
          />
        </AppShellFooter>
      )}
      <MoreSheet open={moreOpen} onOpenChange={setMoreOpen} />
    </AppShell>
  );
}
