import { useNavigate, useRouterState } from "@tanstack/react-router";
import {
  SideNavigation,
  SideNavigationIcon,
  SideNavigationItem,
  SideNavigationLabel,
  SideNavigationLink,
  SideNavigationList,
} from "@slotted/react/side-navigation";

import type { MouseEvent } from "react";

import { destinations } from "@/app/shell/destinations";
import { useT } from "@/i18n/i18n-provider";
import { bestMatch } from "@/ui/best-match";
import { IconGlyph } from "@/ui/icon-glyph";

// A plain primary-button click navigates in-page; modified clicks keep the browser's link behaviour.
function isPlainClick(event: MouseEvent): boolean {
  return (
    !event.defaultPrevented &&
    event.button === 0 &&
    !(event.metaKey || event.ctrlKey || event.shiftKey || event.altKey)
  );
}

export function SideNav({
  mode,
  onMore,
}: {
  mode: "compact" | "expanded";
  onMore: () => void;
}) {
  const t = useT();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const currentPath = bestMatch(
    pathname,
    destinations.map((d) => d.to),
  );
  const current = destinations.find((d) => d.to === currentPath)?.key ?? null;
  return (
    <SideNavigation value={current} mode={mode}>
      <SideNavigationList>
        {destinations.map((d) => (
          <SideNavigationItem key={d.key} value={d.key}>
            <SideNavigationLink
              href={d.to}
              onClick={(event) => {
                if (!isPlainClick(event)) return;
                event.preventDefault();
                void navigate({ to: d.to });
              }}
            >
              <SideNavigationIcon>{d.icon}</SideNavigationIcon>
              <SideNavigationLabel>{t(d.label)}</SideNavigationLabel>
            </SideNavigationLink>
          </SideNavigationItem>
        ))}
        <SideNavigationItem value="more">
          <SideNavigationLink onClick={onMore}>
            <SideNavigationIcon>
              <IconGlyph name="more" />
            </SideNavigationIcon>
            <SideNavigationLabel>{t("nav.more")}</SideNavigationLabel>
          </SideNavigationLink>
        </SideNavigationItem>
      </SideNavigationList>
    </SideNavigation>
  );
}
