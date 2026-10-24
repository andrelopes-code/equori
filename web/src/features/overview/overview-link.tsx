import { Link } from "@slotted/react/link";
import { useRouter } from "@tanstack/react-router";
import type { NavigateOptions } from "@tanstack/react-router";
import type { ReactNode } from "react";

import { useAppLink } from "@/ui/use-app-link";

export function OverviewLink({
  options,
  children,
}: {
  options: NavigateOptions;
  children: ReactNode;
}) {
  const router = useRouter();
  const follow = useAppLink();
  return (
    <Link href={router.buildLocation(options).href} onClick={follow(options)}>
      {children}
    </Link>
  );
}
