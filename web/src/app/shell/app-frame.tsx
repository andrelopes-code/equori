import { Outlet } from "@tanstack/react-router";
import {
  AppShell,
  AppShellBanner,
  AppShellFooter,
  AppShellMain,
  AppShellNav,
} from "@slotted/react/app-shell";
import { PageDefaultsProvider } from "@slotted/react/page";
import { PageHeaderDefaultsProvider } from "@slotted/react/page-header";
import { SectionDefaultsProvider } from "@slotted/react/section";
import { ToastRegion } from "@slotted/react/toast";
import type { CommandPaletteHandle } from "@slotted/react/command-palette";
import { useCallback, useEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";

import styles from "@/app/shell/app-frame.module.css";
import { CalculatorWindow } from "@/app/shell/calculator/calculator-window";
import { useCalculatorOpen } from "@/app/shell/calculator/use-calculator-open";
import { CommandMenu } from "@/app/shell/command-menu/command-menu";
import { DesktopNav } from "@/app/shell/desktop-nav/desktop-nav";
import { PhoneDock } from "@/app/shell/phone-dock/phone-dock";
import { PhoneGate } from "@/app/shell/phone-gate/phone-gate";
import { ReadOnlyNotice } from "@/app/shell/read-only-notice/read-only-notice";
import { TopAppBar } from "@/app/shell/top-app-bar/top-app-bar";
import { useEditing } from "@/app/shell/frame-state/use-editing";
import {
  useEntry,
  useEntryShortcut,
  useKeyShortcut,
} from "@/app/shell/frame-state/use-entry";
import { useNavPreference } from "@/app/shell/desktop-nav/use-nav-preference";
import { useAsideLimit } from "@/app/shell/frame-state/use-aside-limit";
import { useExtent } from "@/app/shell/frame-state/use-extent";
import { useScrollState } from "@/app/shell/frame-state/use-scroll-state";
import { useWide } from "@/app/shell/phone-gate/use-wide";
import {
  AssistantPanel,
  useAssistantAsk,
  useBeside,
} from "@/features/assistant";
import { AppearanceSync } from "@/features/session";
import { useCaptureQueueNotice } from "@/features/transactions";
import { useT } from "@/i18n/i18n-provider";
import { ProfileLocale } from "@/i18n/profile-locale";
import { applyDensity, readDensity } from "@/theme/density";
import { cx } from "@/ui/cx";

const stickyFooter = "var(--slotted-page-sticky-bottom, 0px)";

// The assistant pane's smallest share of the shell. The splitter alone enforces it: a CSS minimum
// beside it leaves a stretch of the drag where the pointer moves and the pane does not.
const ASIDE_MIN_EXTENT = 0.3;

// The family's own largest share of the shell for the pane; useAsideLimit lowers it where the
// page would keep less than 600 px.
const ASIDE_MAX_EXTENT = 0.6;

// One AppShell holds both layouts, so the routed page keeps its place in the tree when the
// width crosses the desktop step: the regions of the other layout render as null beside it.
export function AppFrame() {
  useCaptureQueueNotice();
  const t = useT();
  const wide = useWide();
  const main = useRef<HTMLElement>(null);
  const [navOpen, setNavOpen] = useNavPreference();
  const palette = useRef<CommandPaletteHandle>(null);
  const scroll = useScrollState(main);
  const asideLimit = useAsideLimit(main, ASIDE_MIN_EXTENT, ASIDE_MAX_EXTENT);
  const [barExtent, barRef] = useExtent();
  const [dockExtent, dockRef] = useExtent();
  const [assistantOpen, setAssistantOpen] = useState(false);
  const beside = useBeside();
  const returnTo = useRef<HTMLElement | null>(null);
  const openAssistant = useCallback(() => {
    returnTo.current =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    setAssistantOpen(true);
  }, []);
  const calculator = useCalculatorOpen(wide);
  const editing = useEditing();
  const openEntry = useEntry();
  useEntryShortcut(openEntry);
  useKeyShortcut("a", openAssistant);
  useAssistantAsk(openAssistant);
  const openPalette = useCallback(() => {
    palette.current?.open();
  }, []);
  // A press on the current destination at its own route returns the page to its top.
  const scrollToTop = useCallback(() => {
    main.current?.scrollTo({
      top: 0,
      behavior: matchMedia("(prefers-reduced-motion: reduce)").matches
        ? "auto"
        : "smooth",
    });
  }, []);

  useEffect(() => {
    applyDensity(readDensity());
  }, []);

  return (
    <AppShell
      primary="nav"
      canvas={wide ? "inset" : "flush"}
      navMode="inline"
      navSize="sm"
      navOpen={wide && navOpen}
      onNavOpenChange={(next) => {
        if (wide) setNavOpen(next);
      }}
      collapsedTo={wide ? "rail" : "hidden"}
      // P9: from 1200 px the assistant is a pane beside the page, which narrows.
      asideMode="inline"
      defaultAsideExtent={ASIDE_MIN_EXTENT}
      minAsideExtent={ASIDE_MIN_EXTENT}
      maxAsideExtent={asideLimit}
      asideOpen={beside && assistantOpen}
      onAsideOpenChange={setAssistantOpen}
      messages={{
        nav: t("nav.label"),
        open: t("nav.expand"),
        close: t("nav.collapse"),
        aside: t("assistant.title"),
      }}
    >
      {wide ? (
        <AppShellNav>
          <DesktopNav
            onSearch={openPalette}
            onAssistant={openAssistant}
            onCalculator={calculator.toggle}
            onReselect={scrollToTop}
          />
        </AppShellNav>
      ) : (
        <AppShellBanner
          ref={barRef}
          className={scroll.scrolled ? styles.bannerScrolled : styles.banner}
        >
          <TopAppBar
            scrolled={scroll.scrolled}
            onSearch={openPalette}
            onAssistant={openAssistant}
          />
        </AppShellBanner>
      )}
      <AppShellMain
        ref={main}
        className={cx(!wide && styles.main)}
        // The page sets --slotted-page-sticky-bottom on this scroller to the height of its sticky
        // footer. A field the browser scrolls into view above the keyboard stops at the scroller's
        // edge, under that footer, unless the scroll padding holds the footer too.
        style={
          wide
            ? { scrollPaddingBlockEnd: stickyFooter }
            : ({
                // The bar over the scroller's top edge, for what compares a box with the viewport.
                "--equori-bar-extent": `${String(barExtent)}px`,
                paddingBlockStart: barExtent,
                paddingBlockEnd: dockExtent,
                scrollPaddingBlock: `${String(barExtent)}px calc(${String(dockExtent)}px + ${stickyFooter})`,
              } as CSSProperties)
        }
      >
        <ReadOnlyNotice />

        {/* 32 px beside a column, 16 px on a phone. */}
        <PageDefaultsProvider inset={wide ? 9 : 6}>
          <PageHeaderDefaultsProvider variant="plain" material>
            <SectionDefaultsProvider size="sm">
              <PhoneGate>
                <Outlet />
              </PhoneGate>
            </SectionDefaultsProvider>
          </PageHeaderDefaultsProvider>
        </PageDefaultsProvider>
      </AppShellMain>
      {wide || editing ? null : (
        // A div: the dock is navigation, not the page's contentinfo.
        <AppShellFooter
          ref={dockRef}
          className={styles.footer}
          render={(props) => <div {...props} />}
        >
          <PhoneDock onReselect={scrollToTop} extent={dockExtent} />
        </AppShellFooter>
      )}
      <CommandMenu
        ref={palette}
        onAssistant={openAssistant}
        onCalculator={wide ? calculator.toggle : undefined}
      />
      <CalculatorWindow open={calculator.open} onClose={calculator.close} />
      <AssistantPanel
        open={assistantOpen}
        onOpenChange={setAssistantOpen}
        returnFocus={returnTo}
        beside={beside}
      />
      <ToastRegion />
      {/* BK21: mounted with the session, so a sign-in reads the member's choices; above the
          router, a 401 on /login cleared the cache under their queries and they never updated. */}
      <ProfileLocale />
      <AppearanceSync />
    </AppShell>
  );
}
