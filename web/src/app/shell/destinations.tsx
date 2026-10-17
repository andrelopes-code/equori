import type { ReactNode } from "react";

import type { MessageKey } from "@/i18n/catalog.en";
import { IconGlyph } from "@/ui/icon-glyph";

interface Destination {
  key: "home" | "transactions" | "accounts";
  to: "/" | "/transactions" | "/accounts";
  label: MessageKey;
  icon: ReactNode;
}

export const destinations: readonly Destination[] = [
  { key: "home", to: "/", label: "nav.home", icon: <IconGlyph name="home" /> },
  {
    key: "transactions",
    to: "/transactions",
    label: "nav.transactions",
    icon: <IconGlyph name="list" />,
  },
  {
    key: "accounts",
    to: "/accounts",
    label: "nav.accounts",
    icon: <IconGlyph name="wallet" />,
  },
];
