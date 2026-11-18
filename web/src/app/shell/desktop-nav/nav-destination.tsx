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
  // The column is narrowed to icons.
  rail: boolean;
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

// A row of the desktop column. A destination whose page has tabs holds two controls: its link
// goes to the page and opens the tabs as rows of their own; the arrow at its end only opens or
// closes them. In the rail no arrow is drawn, so the row is one button that goes to the page
// and lists the tabs beside the icon.
export function NavDestination({
  destination,
  count,
  rail,
  expanded,
  current,
  onPress,
  onPressGroup,
  onPressView,
}: NavDestinationProps) {
  const t = useT();
  const views = destinationViews[destination.key];
  const button = views !== undefined && rail;

  const content = (
    <>
      <SideNavigationIcon>
        <ShellIcon name={destination.icon} />
      </SideNavigationIcon>
      <SideNavigationLabel>{t(destination.label)}</SideNavigationLabel>
      {count !== undefined && (
        <SideNavigationCount>{count}</SideNavigationCount>
      )}
    </>
  );

  return (
    <SideNavigationItem
      value={destination.key}
      // Workaround for Slotted issue #144: an item whose row is a trigger is never marked.
      data-current={button && current ? "" : undefined}
    >
      {button && (
        <SideNavigationTrigger onClick={onPressGroup(destination, expanded)}>
          {content}
        </SideNavigationTrigger>
      )}
      {!button && (
        <SideNavigationLink
          href={destination.to}
          onClick={onPress(destination)}
        >
          {content}
        </SideNavigationLink>
      )}
      {views !== undefined && !rail && (
        <SideNavigationTrigger className="ml-2" />
      )}

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
