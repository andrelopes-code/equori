import type { ReactNode } from "react";

import type { MessageKey } from "@/i18n/catalog.en";
import { HomeIcon, ListIcon, WalletIcon } from "@/ui/icons";

interface Destination {
  key: "home" | "transactions" | "accounts";
  to: "/" | "/transactions" | "/accounts";
  label: MessageKey;
  icon: ReactNode;
}

export const destinations: readonly Destination[] = [
  { key: "home", to: "/", label: "nav.home", icon: <HomeIcon /> },
  {
    key: "transactions",
    to: "/transactions",
    label: "nav.transactions",
    icon: <ListIcon />,
  },
  {
    key: "accounts",
    to: "/accounts",
    label: "nav.accounts",
    icon: <WalletIcon />,
  },
];
