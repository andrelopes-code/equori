import {
  SideNavigationCount,
  SideNavigationGroup,
  SideNavigationIcon,
  SideNavigationItem,
  SideNavigationLabel,
  SideNavigationLink,
  SideNavigationTrigger,
} from "@slotted/react/side-navigation";
import type { MouseEvent } from "react";

import {
  destinationViews,
  viewHref,
} from "@/app/shell/destinations/destination-views";
import type { DestinationView } from "@/app/shell/destinations/destination-views";
import type { Destination } from "@/app/shell/destinations/destinations";
import { ShellIcon } from "@/app/shell/destinations/shell-icon";
import { useT } from "@/i18n/i18n-provider";

interface NavDestinationProps {
  destination: Destination;
  count?: string | undefined;
  // The reader opened the views of this destination.
  expanded: boolean;
  // The reader is on a view of this destination that the column does not show.
  holdsHidden: boolean;
  onPress: (destination: Destination) => (event: MouseEvent) => void;
  onPressView: (view: DestinationView) => (event: MouseEvent) => void;
}

// A row of the desktop column: the destination and, when its page has tabs, a trigger that
// opens them as rows of their own. The rows of a closed group are not rendered: the stylesheet
// alone hides them, and a reader of the markup would still meet them.
export function NavDestination({
  destination,
  count,
  expanded,
  holdsHidden,
  onPress,
  onPressView,
}: NavDestinationProps) {
  const t = useT();
  const views = destinationViews[destination.key];

  return (
    <SideNavigationItem value={destination.key}>
      <SideNavigationLink
        href={destination.to}
        current={holdsHidden || undefined}
        onClick={onPress(destination)}
      >
        <SideNavigationIcon>
          <ShellIcon name={destination.icon} />
        </SideNavigationIcon>
        <SideNavigationLabel>{t(destination.label)}</SideNavigationLabel>
        {count !== undefined && (
          <SideNavigationCount>{count}</SideNavigationCount>
        )}
      </SideNavigationLink>

      {views !== undefined && <SideNavigationTrigger />}

      {views !== undefined && (
        <SideNavigationGroup>
          {expanded &&
            views.map((view) => (
              <SideNavigationItem key={view.key} value={view.key}>
                <SideNavigationLink
                  href={viewHref(view)}
                  onClick={onPressView(view)}
                >
                  <SideNavigationLabel>{t(view.label)}</SideNavigationLabel>
                </SideNavigationLink>
              </SideNavigationItem>
            ))}
        </SideNavigationGroup>
      )}
    </SideNavigationItem>
  );
}
