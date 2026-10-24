import { Link } from "@slotted/react/link";
import { useRouter } from "@tanstack/react-router";
import type { NavigateOptions } from "@tanstack/react-router";
import type { ReactNode } from "react";

import { useAppLink } from "@/ui/use-app-link";

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
  const router = useRouter();
  const follow = useAppLink();
  return (
    <Link
      href={router.buildLocation(options).href}
      onClick={follow(options)}
      {...(label === undefined ? {} : { "aria-label": label })}
    >
      {children}
    </Link>
  );
}
