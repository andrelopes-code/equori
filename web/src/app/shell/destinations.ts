import type { MessageKey } from "@/i18n/catalog.en";

export interface Destination {
  key: "home" | "transactions" | "goals" | "cards" | "accounts" | "admin";
  to: "/" | "/transactions" | "/goals" | "/cards" | "/accounts" | "/admin";
  label: MessageKey;
}

// Destinations carry no glyph.
export const destinations: readonly Destination[] = [
  { key: "home", to: "/", label: "nav.overview" },
  { key: "transactions", to: "/transactions", label: "nav.transactions" },
  { key: "goals", to: "/goals", label: "nav.goals" },
  { key: "cards", to: "/cards", label: "nav.cards" },
  { key: "accounts", to: "/accounts", label: "nav.accounts" },
  { key: "admin", to: "/admin", label: "nav.admin" },
];
