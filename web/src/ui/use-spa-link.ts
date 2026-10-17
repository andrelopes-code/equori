import { useRouter } from "@tanstack/react-router";
import type { MouseEvent } from "react";

// A plain primary-button click navigates in-page; modified clicks keep the browser's link behaviour.
export function useSpaLink(): (href: string) => {
  href: string;
  onClick: (event: MouseEvent) => void;
} {
  const router = useRouter();
  return (href) => ({
    href,
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
      void router.navigate({ href });
    },
  });
}
