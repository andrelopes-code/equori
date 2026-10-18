import type { MessageKey } from "@/i18n/catalog.en";

interface Destination {
  key: "home" | "transactions" | "goals" | "cards" | "accounts";
  to: "/" | "/transactions" | "/goals" | "/cards" | "/accounts";
  label: MessageKey;
}

// Ledger sheet L13: destinations carry no glyph. Complete frontend G7 orders them.
export const destinations: readonly Destination[] = [
  { key: "home", to: "/", label: "nav.overview" },
  { key: "transactions", to: "/transactions", label: "nav.transactions" },
  { key: "goals", to: "/goals", label: "nav.goals" },
  { key: "cards", to: "/cards", label: "nav.cards" },
  { key: "accounts", to: "/accounts", label: "nav.accounts" },
];
