import type { MessageKey } from "@/i18n/catalog.en";

interface Destination {
  key: "home" | "transactions" | "accounts";
  to: "/" | "/transactions" | "/accounts";
  label: MessageKey;
}

// Ledger sheet L13: destinations carry no glyph.
export const destinations: readonly Destination[] = [
  { key: "home", to: "/", label: "nav.overview" },
  { key: "transactions", to: "/transactions", label: "nav.transactions" },
  { key: "accounts", to: "/accounts", label: "nav.accounts" },
];
