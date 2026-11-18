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
  // The views of this destination are on screen.
  expanded: boolean;
  // The location is on this destination and on none of its views.
  current: boolean;
  onPress: (destination: Destination) => (event: MouseEvent) => void;
  onPressGroup: (
    destination: Destination,
    open: boolean,
  ) => (event: MouseEvent) => void;
  onPressView: (view: DestinationView) => (event: MouseEvent) => void;
}

// A row of the desktop column. A destination whose page has tabs is one button: its press goes
// to the page and opens the tabs as rows of their own; on the page, it opens or closes them.
export function NavDestination({
  destination,
  count,
  expanded,
  current,
  onPress,
  onPressGroup,
  onPressView,
}: NavDestinationProps) {
  const t = useT();
  const views = destinationViews[destination.key];
  const Row = views === undefined ? SideNavigationLink : SideNavigationTrigger;
  const rowProps =
    views === undefined
      ? { href: destination.to, onClick: onPress(destination) }
      : { onClick: onPressGroup(destination, expanded) };

  return (
    <SideNavigationItem
      value={destination.key}
      // Workaround for Slotted issue #144: an item whose row is a trigger is never marked.
      data-current={views !== undefined && current ? "" : undefined}
    >
      <Row {...rowProps}>
        <SideNavigationIcon>
          <ShellIcon name={destination.icon} />
        </SideNavigationIcon>
        <SideNavigationLabel>{t(destination.label)}</SideNavigationLabel>
        {count !== undefined && (
          <SideNavigationCount>{count}</SideNavigationCount>
        )}
      </Row>

      {views !== undefined && (
        <SideNavigationGroup>
          {views.map((view) => (
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
