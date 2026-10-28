import { Link } from "@slotted/react/link";
import type { ReactNode } from "react";

import type { components } from "@/api/schema.gen";
import { accountRoute } from "@/features/accounts/account-route";
import { routeTo } from "@/ui/route-to";

type Account = components["schemas"]["Account"];

export function AccountLink({
  account,
  children,
}: {
  account: Pick<Account, "id" | "kind">;
  children: ReactNode;
}) {
  return (
    <Link
      variant="neutral"
      underline="hover"
      render={routeTo(accountRoute(account))}
    >
      {children}
    </Link>
  );
}
