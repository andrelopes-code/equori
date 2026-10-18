import { useRouterState } from "@tanstack/react-router";
import { Badge } from "@slotted/react/badge";
import { ButtonLink } from "@slotted/react/button";
import { Kbd } from "@slotted/react/kbd";
import {
  TopNavigation,
  TopNavigationActions,
  TopNavigationBrand,
  TopNavigationHome,
  TopNavigationItem,
  TopNavigationLink,
  TopNavigationList,
  TopNavigationName,
  TopNavigationNav,
} from "@slotted/react/top-navigation";

import { destinations } from "@/app/shell/destinations";
import {
  newTransactionHref,
  useOpenAccountID,
} from "@/app/shell/use-open-account-id";
import { useUncategorizedBadge } from "@/app/shell/use-uncategorized-badge";
import { UserMenu } from "@/app/shell/user-menu";
import { SyncStatus } from "@/features/connections";
import { useT } from "@/i18n/i18n-provider";
import { bestMatch } from "@/ui/best-match";
import { useSpaLink } from "@/ui/use-spa-link";
import { useViewport } from "@/ui/use-viewport";

// Ledger sheet L4: brand, destinations, then sync status, New and the user menu.
export function TopBar() {
  const t = useT();
  const viewport = useViewport();
  const spaLink = useSpaLink();
  const badge = useUncategorizedBadge();
  const accountID = useOpenAccountID();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const currentPath = bestMatch(
    pathname,
    destinations.map((d) => d.to),
  );
  const current = destinations.find((d) => d.to === currentPath)?.key ?? null;
  return (
    <TopNavigation value={current}>
      <TopNavigationBrand>
        <TopNavigationHome {...spaLink("/")}>
          <TopNavigationName>{t("app.name")}</TopNavigationName>
        </TopNavigationHome>
      </TopNavigationBrand>
      <TopNavigationNav aria-label={t("nav.label")}>
        <TopNavigationList>
          {destinations.map((d) => (
            <TopNavigationItem key={d.key} value={d.key} priority="high">
              <TopNavigationLink {...spaLink(d.to)}>
                {t(d.label)}
                {d.key === "transactions" && badge !== undefined && (
                  <Badge tone="warning" size="sm">
                    {badge}
                  </Badge>
                )}
              </TopNavigationLink>
            </TopNavigationItem>
          ))}
        </TopNavigationList>
      </TopNavigationNav>
      <TopNavigationActions>
        {viewport === "desktop" && <SyncStatus />}
        <ButtonLink
          {...spaLink(newTransactionHref(accountID))}
          tone="secondary"
          variant="outline"
          size="sm"
          end={<Kbd>{t("nav.entry.key")}</Kbd>}
        >
          {t("nav.entry")}
        </ButtonLink>
        <UserMenu />
      </TopNavigationActions>
    </TopNavigation>
  );
}
