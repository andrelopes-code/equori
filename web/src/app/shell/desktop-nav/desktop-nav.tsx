import {
  AppShellNavBody,
  AppShellNavFooter,
  AppShellNavHeader,
  AppShellNavToggle,
  useAppShell,
} from "@slotted/react/app-shell";
import { IconButton } from "@slotted/react/button";
import { Glyph, Icon } from "@slotted/react/icon";
import {
  SideNavigation,
  SideNavigationList,
} from "@slotted/react/side-navigation";

import { AccountMenu } from "@/app/shell/account-menu/account-menu";
import { BrandMark } from "@/ui/display/brand-mark";
import styles from "@/app/shell/desktop-nav/desktop-nav.module.css";
import { NavCommand } from "@/app/shell/desktop-nav/nav-command";
import { NavDestination } from "@/app/shell/desktop-nav/nav-destination";
import { useNavGroups } from "@/app/shell/desktop-nav/use-nav-groups";
import { destinations } from "@/app/shell/destinations/destinations";
import { useDestinationPress } from "@/app/shell/destinations/use-destination-press";
import { useEntry } from "@/app/shell/frame-state/use-entry";
import { useUncategorizedCount } from "@/app/shell/destinations/use-uncategorized-count";
import { useT } from "@/i18n/i18n-provider";

// The palette's chord as aria-keyshortcuts names it; Shortcut draws it for the platform itself.
const paletteChord = /Mac|iPhone|iPad/.test(navigator.userAgent)
  ? "Meta+K"
  : "Control+K";

// Settings is reached from the account menu; the column lists the rest.
const listed = destinations.filter((d) => d.key !== "settings");

interface DesktopNavProps {
  onSearch: () => void;
  onAssistant: () => void;
  onCalculator: () => void;
  onReselect: () => void;
}

// The desktop column: the brand and the control that narrows the column, the two commands the
// reader reaches for first, the destinations and, at the foot, the account.
export function DesktopNav({
  onSearch,
  onAssistant,
  onCalculator,
  onReselect,
}: DesktopNavProps) {
  const t = useT();
  const { open } = useAppShell();
  const openEntry = useEntry();
  const count = useUncategorizedCount();
  const { selected, selectedView, press, pressGroup, pressView } =
    useDestinationPress(onReselect);
  const [groups, setGroups] = useNavGroups();
  const entryKey = t("nav.entry.key");
  const assistantKey = t("assistant.key");
  const calculatorKey = t("calculator.key");

  return (
    <>
      <AppShellNavHeader>
        <div className={styles.head} data-open={open || undefined}>
          <span className={styles.brand} aria-hidden={!open || undefined}>
            <span className={styles.mark}>
              <BrandMark size={22} />
            </span>
            <span className={styles.wordmark}>{t("app.name")}</span>
          </span>
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
          <NavCommand
            open={open}
            primary
            icon="plus"
            label={t("nav.entry.long")}
            shortcut={entryKey}
            legend={entryKey}
            onClick={openEntry}
          />
          <NavCommand
            open={open}
            icon="search"
            label={t("nav.search")}
            shortcut={paletteChord}
            legend="mod+k"
            onClick={onSearch}
          />
          <NavCommand
            open={open}
            icon="assistant"
            label={t("assistant.title")}
            railLabel={t("assistant.open")}
            shortcut={assistantKey}
            legend={assistantKey}
            onClick={onAssistant}
          />
          <NavCommand
            open={open}
            icon="calculator"
            label={t("calculator.title")}
            railLabel={t("calculator.open")}
            shortcut={calculatorKey}
            legend={calculatorKey}
            onClick={onCalculator}
          />
        </div>
        <SideNavigation
          value={selectedView ?? selected ?? null}
          expanded={groups}
          autoExpand={false}
          onExpandedChange={setGroups}
        >
          <SideNavigationList>
            {listed.map((destination) => (
              <NavDestination
                key={destination.key}
                destination={destination}
                count={destination.key === "transactions" ? count : undefined}
                expanded={open && groups.includes(destination.key)}
                current={
                  selected === destination.key && selectedView === undefined
                }
                onPress={press}
                onPressGroup={pressGroup}
                onPressView={pressView}
              />
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
