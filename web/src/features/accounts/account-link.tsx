import { Link } from "@slotted/react/link";
import type { ReactNode } from "react";

import type { components } from "@/api/schema.gen";
import { accountHref, accountRoute } from "@/features/accounts/account-route";
import { useAppLink } from "@/ui/use-app-link";

type Account = components["schemas"]["Account"];

export function AccountLink({
  account,
  children,
}: {
  account: Pick<Account, "id" | "kind">;
  children: ReactNode;
}) {
  const follow = useAppLink();
  return (
    <Link
      variant="neutral"
      underline="hover"
      href={accountHref(account)}
      onClick={follow(accountRoute(account))}
    >
      {children}
    </Link>
  );
}
