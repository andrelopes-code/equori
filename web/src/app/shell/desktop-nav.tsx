import {
  AppShellNavBody,
  AppShellNavFooter,
  AppShellNavHeader,
  AppShellNavToggle,
  useAppShell,
} from "@slotted/react/app-shell";
import { Button, IconButton } from "@slotted/react/button";
import { Glyph, Icon } from "@slotted/react/icon";
import { Shortcut } from "@slotted/react/kbd";
import {
  SideNavigation,
  SideNavigationCount,
  SideNavigationDivider,
  SideNavigationIcon,
  SideNavigationItem,
  SideNavigationLabel,
  SideNavigationLink,
  SideNavigationList,
} from "@slotted/react/side-navigation";
import { Fragment } from "react";

import { AccountMenu } from "@/app/shell/account-menu";
import { BrandMark } from "@/ui/brand-mark";
import styles from "@/app/shell/desktop-nav.module.css";
import { destinations } from "@/app/shell/destinations";
import { ShellIcon } from "@/app/shell/shell-icon";
import { useDestinationPress } from "@/app/shell/use-destination-press";
import { useEntry } from "@/app/shell/use-entry";
import { useUncategorizedCount } from "@/app/shell/use-uncategorized-count";
import { useT } from "@/i18n/i18n-provider";

// The palette's chord as aria-keyshortcuts names it; Shortcut draws it for the platform itself.
const paletteChord = /Mac|iPhone|iPad/.test(navigator.userAgent)
  ? "Meta+K"
  : "Control+K";

// Settings is reached from the account menu; the column lists the rest, Admin after a rule.
const listed = destinations.filter((d) => d.key !== "settings");

// A command's key legend. It is decoration: aria-keyshortcuts on the command names the key.
function keys(shortcut: string) {
  return (
    <Shortcut
      className={styles.keys}
      keys={shortcut}
      size="xs"
      variant="soft"
      aria-hidden="true"
    />
  );
}

// The desktop column: the brand and the control that narrows the column, the two commands the
// reader reaches for first, the destinations and, at the foot, the account.
export function DesktopNav({
  onSearch,
  onAssistant,
  onReselect,
}: {
  onSearch: () => void;
  onAssistant: () => void;
  onReselect: () => void;
}) {
  const t = useT();
  const { open } = useAppShell();
  const openEntry = useEntry();
  const count = useUncategorizedCount();
  const { selected, press } = useDestinationPress(onReselect);
  const entryKey = t("nav.entry.key");
  const assistantKey = t("assistant.key");

  return (
    <>
      <AppShellNavHeader>
        <div className={styles.head} data-open={open || undefined}>
          {open && (
            <span className={styles.brand}>
              <BrandMark size={22} />
              <span className={styles.wordmark}>{t("app.name")}</span>
            </span>
          )}
          <AppShellNavToggle
            render={(props) => (
              <IconButton {...props} aria-label={props["aria-label"] ?? ""}>
                <Icon>
                  <Glyph name={open ? "panel-close" : "panel-open"} />
                </Icon>
              </IconButton>
            )}
          />
        </div>
      </AppShellNavHeader>
      <AppShellNavBody>
        <div className={styles.commands} data-open={open || undefined}>
          {open ? (
            <>
              <Button
                fullWidth
                justify="between"
                aria-keyshortcuts={entryKey}
                start={
                  <Icon size="sm">
                    <ShellIcon name="plus" />
                  </Icon>
                }
                end={keys(entryKey)}
                onClick={openEntry}
              >
                {t("nav.entry.long")}
              </Button>
              <Button
                fullWidth
                justify="between"
                tone="secondary"
                variant="outline"
                aria-keyshortcuts={paletteChord}
                start={
                  <Icon size="sm">
                    <ShellIcon name="search" />
                  </Icon>
                }
                end={keys("mod+k")}
                onClick={onSearch}
              >
                {t("nav.search")}
              </Button>
              <Button
                fullWidth
                justify="between"
                tone="secondary"
                variant="outline"
                aria-keyshortcuts={assistantKey}
                start={
                  <Icon size="sm">
                    <ShellIcon name="assistant" />
                  </Icon>
                }
                end={keys(assistantKey)}
                onClick={onAssistant}
              >
                {t("assistant.title")}
              </Button>
            </>
          ) : (
            <>
              <IconButton
                aria-label={t("nav.entry.long")}
                aria-keyshortcuts={entryKey}
                tone="accent"
                variant="solid"
                onClick={openEntry}
              >
                <Icon>
                  <ShellIcon name="plus" />
                </Icon>
              </IconButton>
              <IconButton
                aria-label={t("nav.search")}
                aria-keyshortcuts={paletteChord}
                onClick={onSearch}
              >
                <Icon>
                  <ShellIcon name="search" />
                </Icon>
              </IconButton>
              <IconButton
                aria-label={t("assistant.open")}
                aria-keyshortcuts={assistantKey}
                onClick={onAssistant}
              >
                <Icon>
                  <ShellIcon name="assistant" />
                </Icon>
              </IconButton>
            </>
          )}
        </div>
        <SideNavigation value={selected ?? null}>
          <SideNavigationList>
            {listed.map((destination) => (
              <Fragment key={destination.key}>
                {destination.key === "admin" && <SideNavigationDivider />}
                <SideNavigationItem value={destination.key}>
                  <SideNavigationLink
                    href={destination.to}
                    onClick={press(destination)}
                  >
                    <SideNavigationIcon>
                      <ShellIcon name={destination.icon} />
                    </SideNavigationIcon>
                    <SideNavigationLabel>
                      {t(destination.label)}
                    </SideNavigationLabel>
                    {destination.key === "transactions" &&
                      count !== undefined && (
                        <SideNavigationCount>{count}</SideNavigationCount>
                      )}
                  </SideNavigationLink>
                </SideNavigationItem>
              </Fragment>
            ))}
          </SideNavigationList>
        </SideNavigation>
      </AppShellNavBody>
      <AppShellNavFooter>
        <div className={styles.foot}>
          <AccountMenu compact={!open} />
        </div>
      </AppShellNavFooter>
    </>
  );
}
