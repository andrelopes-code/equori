import type { ShellIconName } from "@/app/shell/shell-icon";
import type { MessageKey } from "@/i18n/catalog.en";

export type DestinationKey =
  | "overview"
  | "transactions"
  | "categories"
  | "cards"
  | "accounts"
  | "goals"
  | "planning"
  | "instruments"
  | "portfolio"
  | "admin"
  | "settings";

export interface Destination {
  key: DestinationKey;
  to:
    | "/"
    | "/transactions"
    | "/categories"
    | "/cards"
    | "/accounts"
    | "/goals"
    | "/planning"
    | "/instruments"
    | "/portfolio"
    | "/admin"
    | "/settings";
  label: MessageKey;
  icon: ShellIconName;
  // A phone holds four destinations in its navigation bar and the rest in the More sheet.
  phone: "bar" | "more";
}

export const destinations: readonly Destination[] = [
  {
    key: "overview",
    to: "/",
    label: "nav.overview",
    icon: "overview",
    phone: "bar",
  },
  {
    key: "transactions",
    to: "/transactions",
    label: "nav.transactions",
    icon: "transactions",
    phone: "bar",
  },
  {
    key: "categories",
    to: "/categories",
    label: "nav.categories",
    icon: "categories",
    phone: "more",
  },
  {
    key: "cards",
    to: "/cards",
    label: "nav.cards",
    icon: "cards",
    phone: "bar",
  },
  {
    key: "accounts",
    to: "/accounts",
    label: "nav.accounts",
    icon: "accounts",
    phone: "bar",
  },
  {
    key: "goals",
    to: "/goals",
    label: "nav.goals",
    icon: "goals",
    phone: "more",
  },
  {
    key: "planning",
    to: "/planning",
    label: "nav.planning",
    icon: "planning",
    phone: "more",
  },
  {
    key: "instruments",
    to: "/instruments",
    label: "nav.instruments",
    icon: "instruments",
    phone: "more",
  },
  {
    key: "portfolio",
    to: "/portfolio",
    label: "nav.portfolio",
    icon: "instruments",
    phone: "more",
  },
  {
    key: "admin",
    to: "/admin",
    label: "nav.admin",
    icon: "admin",
    phone: "more",
  },
  {
    key: "settings",
    to: "/settings",
    label: "more.settings",
    icon: "settings",
    phone: "more",
  },
];
