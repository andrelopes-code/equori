import { Outlet } from "@tanstack/react-router";
import {
  AppShell,
  AppShellBanner,
  AppShellFooter,
  AppShellMain,
} from "@slotted/react/app-shell";
import { PageDefaultsProvider } from "@slotted/react/page";
import { PageHeaderDefaultsProvider } from "@slotted/react/page-header";
import { SectionDefaultsProvider } from "@slotted/react/section";
import { ToastRegion } from "@slotted/react/toast";
import { useEffect, useState } from "react";

import { destinations } from "@/app/shell/destinations";
import { MoreSheet } from "@/app/shell/more-sheet";
import { TopBar } from "@/app/shell/top-bar";
import { useNewShortcut } from "@/app/shell/use-new-shortcut";
import { useOpenAccountID } from "@/app/shell/use-open-account-id";
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
  useNewShortcut(useOpenAccountID());

  // Complete frontend G1: comfortable at every width.
  useEffect(() => {
    document.documentElement.setAttribute(
      "data-slotted-density",
      "comfortable",
    );
  }, []);
  const inset = { desktop: 9, tablet: 6, phone: 4 } as const;

  const [home, transactions, accounts] = destinations;

  return (
    <AppShell canvas="flush" messages={{ nav: t("nav.label") }}>
      {viewport !== "phone" && (
        <AppShellBanner>
          <TopBar />
        </AppShellBanner>
      )}
      <AppShellMain>
        {/* Complete frontend G2, G4 and G5: plain headers, ruled sections, wider insets. */}
        <PageDefaultsProvider inset={inset[viewport]}>
          <PageHeaderDefaultsProvider variant="plain">
            <SectionDefaultsProvider size="sm" divider>
              <Outlet />
            </SectionDefaultsProvider>
          </PageHeaderDefaultsProvider>
        </PageDefaultsProvider>
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
