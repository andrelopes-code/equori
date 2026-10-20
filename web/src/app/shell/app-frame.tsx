import { Outlet, useNavigate } from "@tanstack/react-router";
import {
  AppShell,
  AppShellBanner,
  AppShellMain,
} from "@slotted/react/app-shell";
import { PageDefaultsProvider } from "@slotted/react/page";
import { PageHeaderDefaultsProvider } from "@slotted/react/page-header";
import { SectionDefaultsProvider } from "@slotted/react/section";
import { ToastRegion } from "@slotted/react/toast";
import { useCallback, useEffect, useRef, useState } from "react";

import { destinations } from "@/app/shell/destinations";
import { MoreSheet } from "@/app/shell/more-sheet";
import { TopBar } from "@/app/shell/top-bar";
import { useNewShortcut } from "@/app/shell/use-new-shortcut";
import { useUncategorizedBadge } from "@/app/shell/use-uncategorized-badge";
import { useT } from "@/i18n/i18n-provider";
import { BottomBar } from "@/ui/bottom-bar";
import barStyles from "@/ui/bottom-bar.module.css";
import { useViewport } from "@/ui/use-viewport";

// The top bar in the banner from 1024 px, the tab bar below it.
export function AppFrame() {
  const t = useT();
  const viewport = useViewport();
  const badge = useUncategorizedBadge();
  const [moreOpen, setMoreOpen] = useState(false);
  const navigate = useNavigate();
  // The entry opens the temporary admin page until the quick entry is rebuilt.
  const openEntry = useCallback(() => {
    void navigate({ to: "/admin" });
  }, [navigate]);
  useNewShortcut(openEntry);
  const main = useRef<HTMLElement>(null);
  // A tap on the current destination at its own route returns the page to its top.
  const scrollToTop = useCallback(() => {
    main.current?.scrollTo({
      top: 0,
      behavior: matchMedia("(prefers-reduced-motion: reduce)").matches
        ? "auto"
        : "smooth",
    });
  }, []);

  // Comfortable at every width.
  useEffect(() => {
    document.documentElement.setAttribute(
      "data-slotted-density",
      "comfortable",
    );
  }, []);
  // 32, 24 and 16 px; 8 px on a phone pressed the content to the edges.
  const inset = { desktop: 9, tablet: 8, phone: 6 } as const;

  const destination = (key: string) => destinations.find((d) => d.key === key);
  const home = destination("home");
  const transactions = destination("transactions");
  const cards = destination("cards");

  return (
    // No navigation region: the destinations stand in the banner or the tab bar, so the
    // region is held closed and lays no rail or scrim.
    <AppShell
      canvas="flush"
      navOpen={false}
      collapsedTo="hidden"
      messages={{ nav: t("nav.label") }}
    >
      {viewport === "desktop" && (
        <AppShellBanner>
          <TopBar onEntry={openEntry} onReselect={scrollToTop} />
        </AppShellBanner>
      )}
      <AppShellMain ref={main}>
        {/* Plain headers, ruled sections, wider insets. */}
        <PageDefaultsProvider inset={inset[viewport]}>
          <PageHeaderDefaultsProvider variant="plain">
            <SectionDefaultsProvider size="sm" divider>
              <Outlet />
            </SectionDefaultsProvider>
          </PageHeaderDefaultsProvider>
        </PageDefaultsProvider>
        {/* The tab bar floats over the page's foot; this space keeps the last row above it. */}
        {viewport !== "desktop" && (
          <div aria-hidden="true" className={barStyles.space} />
        )}
      </AppShellMain>
      {viewport !== "desktop" && home && transactions && cards && (
        <BottomBar
          onReselect={scrollToTop}
          items={[
            // The bar's short name for the overview: five controls share 360 px.
            {
              key: home.key,
              label: t("nav.home"),
              to: home.to,
              glyph: "home",
            },
            {
              key: transactions.key,
              glyph: "list",
              label: t(transactions.label),
              to: transactions.to,
              badge,
            },
            {
              key: "entry",
              glyph: "plus",
              label: t("nav.entry"),
              onPress: openEntry,
              primary: true,
            },
            {
              key: cards.key,
              label: t(cards.label),
              to: cards.to,
              glyph: "card",
            },
            {
              key: "more",
              glyph: "more",
              label: t("nav.more"),
              onPress: () => {
                setMoreOpen(true);
              },
            },
          ]}
        />
      )}
      <ToastRegion />
      <MoreSheet open={moreOpen} onOpenChange={setMoreOpen} />
    </AppShell>
  );
}
