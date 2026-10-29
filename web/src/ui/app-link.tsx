import { Link } from "@slotted/react/link";
import type { LinkOptions } from "@tanstack/react-router";
import type { ReactNode } from "react";

import { routeTo } from "@/ui/route-to";
import { useServed } from "@/ui/use-served";

// A link to a screen of the application, drawn by the Slotted family (O13): a bare router link
// takes the browser's colour and size. A destination not served at this width draws as its text
// (ADR 027, S6).
export function AppLink({
  to,
  variant = "accent",
  underline = "always",
  children,
}: {
  to: LinkOptions;
  variant?: "accent" | "neutral";
  underline?: "always" | "hover";
  children: ReactNode;
}) {
  const served = useServed();

  if (!served(to)) return children;

  return (
    <Link variant={variant} underline={underline} render={routeTo(to)}>
      {children}
    </Link>
  );
}
