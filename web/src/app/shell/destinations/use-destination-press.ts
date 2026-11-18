import { useNavigate, useRouter, useRouterState } from "@tanstack/react-router";
import { usePressSelection } from "@slotted/react/press-selection";
import type { MouseEvent } from "react";

import {
  destinationViews,
  matchView,
  viewHref,
} from "@/app/shell/destinations/destination-views";
import type { DestinationView } from "@/app/shell/destinations/destination-views";
import type {
  Destination,
  DestinationKey,
} from "@/app/shell/destinations/destinations";
import { matchDestination } from "@/app/shell/destinations/match-destination";

export interface DestinationPress {
  pathname: string;
  // The destination the location is on.
  current: Destination | undefined;
  topLevel: boolean;
  // The destination drawn as current: the pressed one until its route has rendered.
  selected: DestinationKey | undefined;
  // The view drawn as current, when the location is on one.
  selectedView: string | undefined;
  // The press on a destination's link: it goes to the destination, to its first view when
  // it has views.
  press: (destination: Destination) => (event: MouseEvent) => void;
  // The press on a rail row that also lists the views of its destination; open tells that
  // the views are on screen.
  pressGroup: (
    destination: Destination,
    open: boolean,
  ) => (event: MouseEvent) => void;
  pressView: (view: DestinationView) => (event: MouseEvent) => void;
}

// A plain press paints the destination before its route renders; a press on the current
// destination at its own route calls onReselect instead of navigating; a modified click is
// left to the browser. onEnterGroup tells that a press went to a destination that has views.
export function useDestinationPress(
  onReselect: () => void,
  onEnterGroup?: (key: DestinationKey) => void,
): DestinationPress {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const search = useRouterState({ select: (s) => s.location.search });
  const navigate = useNavigate();
  const router = useRouter();
  const { destination, topLevel } = matchDestination(pathname);
  const view = matchView(pathname, search);
  // One selection holds both: a view key is its destination key, a dot and the tab.
  const { selected, select } = usePressSelection(view?.key ?? destination?.key);

  function goToView(target: DestinationView) {
    if (view?.key === target.key) {
      onReselect();
      return;
    }

    select(target.key, () => {
      router.history.push(viewHref(target));
    });
  }

  return {
    pathname,
    current: destination,
    topLevel,
    selected: selected?.split(".")[0] as DestinationKey | undefined,
    selectedView: selected?.includes(".") === true ? selected : undefined,
    press: (target) => (event) => {
      if (!isPlainPress(event)) return;

      event.preventDefault();
      // The destination's own route is its first view: that view is painted with the press.
      const first = destinationViews[target.key]?.[0];
      if (first !== undefined) {
        onEnterGroup?.(target.key);
        goToView(first);
        return;
      }

      if (pathname === target.to) {
        onReselect();
        return;
      }

      select(target.key, () => void navigate({ to: target.to }));
    },
    pressGroup: (target, open) => (event) => {
      // On one of its views, the press only opens or closes them: the row's own part.
      if (view?.key.startsWith(`${target.key}.`) === true) return;

      // An open group stays open; a closed one opens with the navigation.
      if (open) event.preventDefault();

      select(
        destinationViews[target.key]?.[0]?.key ?? target.key,
        () => void navigate({ to: target.to }),
      );
    },
    pressView: (target) => (event) => {
      if (!isPlainPress(event)) return;

      event.preventDefault();
      goToView(target);
    },
  };
}

function isPlainPress(event: MouseEvent): boolean {
  return !(
    event.defaultPrevented ||
    event.button !== 0 ||
    event.metaKey ||
    event.ctrlKey ||
    event.shiftKey ||
    event.altKey
  );
}
