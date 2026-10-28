import { useRouter, useRouterState } from "@tanstack/react-router";
import { IconButton } from "@slotted/react/button";
import { Icon } from "@slotted/react/icon";

import { matchDestination } from "@/app/shell/match-destination";
import { PrivacyToggle } from "@/app/shell/privacy-toggle";
import { ShellIcon } from "@/app/shell/shell-icon";
import styles from "@/app/shell/top-app-bar.module.css";
import { useT } from "@/i18n/i18n-provider";

// Families read: app-shell, top-navigation, page-header. The phone's bar is equori's own by
// choice, drawn as Android's small top app bar: a back control below a destination, the
// destination's name once the page's own header has scrolled under it, and search.
export function TopAppBar({
  scrolled,
  onSearch,
  onAssistant,
}: {
  scrolled: boolean;
  onSearch: () => void;
  onAssistant: () => void;
}) {
  const t = useT();
  const router = useRouter();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  // A settings pane is chosen by the search, below its destination's own route.
  const pane = useRouterState({
    select: (s) => "section" in s.location.search,
  });
  const match = matchDestination(pathname);
  const { destination } = match;
  const topLevel = match.topLevel && !pane;

  const back = () => {
    // A deep link has no entry of the application's own to return to.
    if (router.history.canGoBack()) {
      router.history.back();
      return;
    }
    if (destination !== undefined) void router.navigate({ to: destination.to });
  };

  return (
    <div
      data-own="top-app-bar"
      className={styles.bar}
      data-scrolled={scrolled || undefined}
    >
      <div className={styles.start}>
        {!topLevel && destination !== undefined && (
          <IconButton aria-label={t("nav.back")} size="lg" onClick={back}>
            <Icon directional>
              <ShellIcon name="back" />
            </Icon>
          </IconButton>
        )}
      </div>
      <p className={styles.title} aria-hidden={!scrolled || !topLevel}>
        {topLevel && destination !== undefined ? t(destination.label) : null}
      </p>
      <div className={styles.end}>
        <PrivacyToggle />
        <IconButton
          aria-label={t("assistant.open")}
          size="lg"
          onClick={onAssistant}
        >
          <Icon>
            <ShellIcon name="assistant" />
          </Icon>
        </IconButton>
        <IconButton aria-label={t("nav.search")} size="lg" onClick={onSearch}>
          <Icon>
            <ShellIcon name="search" />
          </Icon>
        </IconButton>
      </div>
    </div>
  );
}
