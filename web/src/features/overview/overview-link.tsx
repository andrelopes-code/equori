import { Link } from "@slotted/react/link";
import type { NavigateOptions } from "@tanstack/react-router";
import type { ReactNode } from "react";

import { routeTo } from "@/ui/route-to";

export function OverviewLink({
  options,
  children,
  label,
}: {
  options: NavigateOptions;
  // The accessible name when the visible text is shorter than what the link opens.
  label?: string;
  children: ReactNode;
}) {
  return (
    <Link
      size="sm"
      render={routeTo(options)}
      {...(label === undefined ? {} : { "aria-label": label })}
    >
      {children}
    </Link>
  );
}
