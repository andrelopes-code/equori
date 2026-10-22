import { useNavigate } from "@tanstack/react-router";
import type { NavigateOptions } from "@tanstack/react-router";
import type { MouseEvent } from "react";

// Workaround for Slotted finding "ButtonLink render props cannot be spread onto a router link":
// the anchor keeps its href for a modified click (new tab, new window), and a plain click
// navigates inside the application.
export function useAppLink() {
  const navigate = useNavigate();
  return (options: NavigateOptions) =>
    (event: MouseEvent<HTMLAnchorElement>) => {
      if (
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      )
        return;
      event.preventDefault();
      void navigate(options);
    };
}
