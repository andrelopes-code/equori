import { useNavigate, useRouterState } from "@tanstack/react-router";
import { usePressSelection } from "@slotted/react/press-selection";
import type { MouseEvent } from "react";

import type { Destination, DestinationKey } from "@/app/shell/destinations";
import { matchDestination } from "@/app/shell/match-destination";

export interface DestinationPress {
  pathname: string;
  // The destination the location is on.
  current: Destination | undefined;
  topLevel: boolean;
  // The destination drawn as current: the pressed one until its route has rendered.
  selected: DestinationKey | undefined;
  press: (destination: Destination) => (event: MouseEvent) => void;
}

// A plain press paints the destination before its route renders; a press on the current
// destination at its own route calls onReselect instead of navigating; a modified click is
// left to the browser.
export function useDestinationPress(onReselect: () => void): DestinationPress {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const navigate = useNavigate();
  const { destination, topLevel } = matchDestination(pathname);
  const { selected, select } = usePressSelection(destination?.key);
  return {
    pathname,
    current: destination,
    topLevel,
    selected,
    press: (target) => (event) => {
      if (
        event.defaultPrevented ||
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      ) {
        return;
      }
      event.preventDefault();
      if (pathname === target.to) {
        onReselect();
        return;
      }
      select(target.key, () => void navigate({ to: target.to }));
    },
  };
}
