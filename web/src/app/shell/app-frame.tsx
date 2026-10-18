import { Outlet } from "@tanstack/react-router";
import {
  AppShell,
  AppShellFooter,
  AppShellMain,
  AppShellNav,
} from "@slotted/react/app-shell";
import { PageDefaultsProvider } from "@slotted/react/page";
import { PageHeaderDefaultsProvider } from "@slotted/react/page-header";
import { SectionDefaultsProvider } from "@slotted/react/section";
import { ToastRegion } from "@slotted/react/toast";
import { useCallback, useEffect, useState } from "react";

import { destinations } from "@/app/shell/destinations";
import { MoreSheet } from "@/app/shell/more-sheet";
import { LedgerIndex } from "@/app/shell/ledger-index";
import { useNewShortcut } from "@/app/shell/use-new-shortcut";
import { useOpenAccountID } from "@/app/shell/use-open-account-id";
import { useUncategorizedBadge } from "@/app/shell/use-uncategorized-badge";
import { QuickEntry } from "@/features/transactions";
import { useT } from "@/i18n/i18n-provider";
import { BottomBar } from "@/ui/bottom-bar";
import { useViewport } from "@/ui/use-viewport";

// Shell second pass S1 and S2: the ledger index beside the page from 1024 px, a bottom bar of
// text below it.
export function AppFrame() {
  const t = useT();
  const viewport = useViewport();
  const badge = useUncategorizedBadge();
  const [moreOpen, setMoreOpen] = useState(false);
  const accountID = useOpenAccountID();
  const [entryOpen, setEntryOpen] = useState(false);
  const openEntry = useCallback(() => {
    setEntryOpen(true);
  }, []);
  useNewShortcut(openEntry);

  // Complete frontend G1: comfortable at every width.
  useEffect(() => {
    document.documentElement.setAttribute(
      "data-slotted-density",
      "comfortable",
    );
  }, []);
  const inset = { desktop: 9, tablet: 6, phone: 4 } as const;

  const destination = (key: string) => destinations.find((d) => d.key === key);
  const home = destination("home");
  const transactions = destination("transactions");
  const cards = destination("cards");

  return (
    <AppShell canvas="flush" messages={{ nav: t("nav.label") }}>
      {viewport === "desktop" && (
        // The index holds its own navigation landmark beside the brand, entry and account.
        <AppShellNav render={(props) => <div {...props} />}>
          <LedgerIndex onEntry={openEntry} />
        </AppShellNav>
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
      {viewport !== "desktop" && home && transactions && cards && (
        <AppShellFooter>
          <BottomBar
            items={[
              // The bar's short name for the overview: five controls share 360 px.
              { key: home.key, label: t("nav.home"), to: home.to },
              {
                key: transactions.key,
                label: t(transactions.label),
                to: transactions.to,
                badge,
              },
              {
                key: "entry",
                label: t("nav.entry"),
                onPress: openEntry,
                ink: true,
              },
              { key: cards.key, label: t(cards.label), to: cards.to },
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
      <QuickEntry
        open={entryOpen}
        onOpenChange={setEntryOpen}
        accountId={accountID}
      />
    </AppShell>
  );
}
