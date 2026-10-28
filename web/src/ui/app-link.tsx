import { Link } from "@slotted/react/link";
import { useRouter } from "@tanstack/react-router";
import type { NavigateOptions } from "@tanstack/react-router";
import type { ReactNode } from "react";

import { useAppLink } from "@/ui/use-app-link";

// A link to a screen of the application, drawn by the Slotted family (O13): a bare router link
// takes the browser's colour and size.
export function AppLink({
  to,
  variant = "accent",
  underline = "always",
  children,
}: {
  to: NavigateOptions;
  variant?: "accent" | "neutral";
  underline?: "always" | "hover";
  children: ReactNode;
}) {
  const router = useRouter();
  const follow = useAppLink();
  return (
    <Link
      variant={variant}
      underline={underline}
      href={router.buildLocation(to).href}
      onClick={follow(to)}
    >
      {children}
    </Link>
  );
}
