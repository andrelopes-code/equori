import { Outlet } from "@tanstack/react-router";
import {
  AppShell,
  AppShellBanner,
  AppShellFooter,
  AppShellMain,
} from "@slotted/react/app-shell";
import { ToastRegion } from "@slotted/react/toast";
import { useEffect, useState } from "react";

import { destinations } from "@/app/shell/destinations";
import { MoreSheet } from "@/app/shell/more-sheet";
import { TopBar } from "@/app/shell/top-bar";
import { useUncategorizedBadge } from "@/app/shell/use-uncategorized-badge";
import { useT } from "@/i18n/i18n-provider";
import { BottomBar } from "@/ui/bottom-bar";
import { useViewport } from "@/ui/use-viewport";

// Ledger sheet L4 and L5: a top bar from 600 px, a bottom bar of text below it.
export function AppFrame() {
  const t = useT();
  const viewport = useViewport();
  const badge = useUncategorizedBadge();
  const [moreOpen, setMoreOpen] = useState(false);

  useEffect(() => {
    document.documentElement.setAttribute(
      "data-slotted-density",
      viewport === "desktop" ? "compact" : "comfortable",
    );
  }, [viewport]);

  const [home, transactions, accounts] = destinations;

  return (
    <AppShell canvas="flush" messages={{ nav: t("nav.label") }}>
      {viewport !== "phone" && (
        <AppShellBanner>
          <TopBar />
        </AppShellBanner>
      )}
      <AppShellMain>
        <Outlet />
      </AppShellMain>
      {viewport === "phone" && home && transactions && accounts && (
        <AppShellFooter>
          <BottomBar
            items={[
              { key: home.key, label: t(home.label), to: home.to },
              {
                key: transactions.key,
                label: t(transactions.label),
                to: transactions.to,
                badge,
              },
              { key: accounts.key, label: t(accounts.label), to: accounts.to },
              {
                key: "more",
                label: t("nav.more"),
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
