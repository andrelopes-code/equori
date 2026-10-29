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
  | "reports"
  | "calculators"
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
    | "/reports"
    | "/calculators"
    | "/settings";
  label: MessageKey;
  icon: ShellIconName;
  // A phone holds four destinations in its navigation bar and the rest in the More sheet;
  // "none" is desktop-only (ADR 027, S6).
  phone: "bar" | "more" | "none";
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
    phone: "none",
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
    phone: "none",
  },
  {
    key: "planning",
    to: "/planning",
    label: "nav.planning",
    icon: "planning",
    phone: "none",
  },
  {
    key: "instruments",
    to: "/instruments",
    label: "nav.instruments",
    icon: "instruments",
    phone: "none",
  },
  {
    key: "portfolio",
    to: "/portfolio",
    label: "nav.portfolio",
    icon: "instruments",
    phone: "none",
  },
  {
    key: "reports",
    to: "/reports",
    label: "nav.reports",
    icon: "reports",
    phone: "none",
  },
  {
    key: "calculators",
    to: "/calculators",
    label: "nav.calculators",
    icon: "calculator",
    phone: "none",
  },
  {
    key: "settings",
    to: "/settings",
    label: "more.settings",
    icon: "settings",
    phone: "more",
  },
];
