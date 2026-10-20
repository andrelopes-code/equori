import { useRouter, useRouterState } from "@tanstack/react-router";
import { useState } from "react";
import type { MouseEvent } from "react";
import { flushSync } from "react-dom";

import { bestMatch } from "@/ui/best-match";

export interface TabSelection {
  // The destination the location is on.
  current: string | undefined;
  // The destination drawn as selected: the tapped one until its route has rendered.
  selected: string | undefined;
  link: (to: string) => {
    href: string;
    onClick: (event: MouseEvent<HTMLAnchorElement>) => void;
  };
}

// Runs `next` once the browser has painted the frame that is being prepared.
function afterPaint(next: () => void) {
  requestAnimationFrame(() => {
    setTimeout(next, 0);
  });
}

// A destination renders and lays out for hundreds of milliseconds
// before the browser paints, so the tap commits the selection alone, lets it paint, and only
// then navigates. A modified click keeps the browser's link behaviour. Slotted finding "No
// helper paints a navigation selection before the route renders".
export function useTabSelection(
  paths: readonly string[],
  onReselect?: () => void,
): TabSelection {
  const router = useRouter();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [pending, setPending] = useState<string>();
  const current = bestMatch(pathname, paths);
  return {
    current,
    selected: pending ?? current,
    link: (to) => ({
      href: to,
      onClick: (event) => {
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
        if (pathname === to) {
          onReselect?.();
          return;
        }
        flushSync(() => {
          setPending(to);
        });
        afterPaint(() => {
          void router.navigate({ to }).finally(() => {
            setPending((held) => (held === to ? undefined : held));
          });
        });
      },
    }),
  };
}
