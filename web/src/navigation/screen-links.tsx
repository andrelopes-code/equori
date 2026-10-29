import type { MarkdownRenderers } from "@slotted/react/markdown";
import type { NavigateOptions } from "@tanstack/react-router";

import { matchScreen } from "@/navigation/navigation-map";
import { AppLink } from "@/ui/app-link";

// A link to a screen of the navigation map becomes a router link; any other link is its label.
export const screenLinks: MarkdownRenderers = {
  link: ({ element, children }) =>
    matchScreen(element.href) === undefined ? (
      children
    ) : (
      // matchScreen has checked that the path is a screen of the router.
      <AppLink to={{ to: element.href as NonNullable<NavigateOptions["to"]> }}>
        {children}
      </AppLink>
    ),
};
