import { useNavigate, useRouter, useRouterState } from "@tanstack/react-router";
import { usePressSelection } from "@slotted/react/press-selection";
import type { MouseEvent } from "react";

import {
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
  press: (destination: Destination) => (event: MouseEvent) => void;
  pressView: (view: DestinationView) => (event: MouseEvent) => void;
}

// A plain press paints the destination before its route renders; a press on the current
// destination at its own route calls onReselect instead of navigating; a modified click is
// left to the browser.
export function useDestinationPress(onReselect: () => void): DestinationPress {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const search = useRouterState({ select: (s) => s.location.search });
  const navigate = useNavigate();
  const router = useRouter();
  const { destination, topLevel } = matchDestination(pathname);
  const view = matchView(pathname, search);
  // One selection holds both: a view key is its destination key, a dot and the tab.
  const { selected, select } = usePressSelection(view?.key ?? destination?.key);

  return {
    pathname,
    current: destination,
    topLevel,
    selected: selected?.split(".")[0] as DestinationKey | undefined,
    selectedView: selected?.includes(".") === true ? selected : undefined,
    press: (target) => (event) => {
      if (!isPlainPress(event)) return;

      event.preventDefault();
      if (pathname === target.to) {
        onReselect();
        return;
      }

      select(target.key, () => void navigate({ to: target.to }));
    },
    pressView: (target) => (event) => {
      if (!isPlainPress(event)) return;

      event.preventDefault();
      if (view?.key === target.key) {
        onReselect();
        return;
      }

      select(target.key, () => {
        router.history.push(viewHref(target));
      });
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
