import type { DestinationKey } from "@/app/shell/destinations/destinations";
import type { MessageKey } from "@/i18n/catalog.en";

// A view is one tab of a destination's page, reached by its own address.
export interface DestinationView {
  // The destination key, a dot and the tab.
  key: string;
  label: MessageKey;
  to: string;
  search?: Readonly<Record<string, string | boolean>>;
}

// The tabs each page header draws, in the order it draws them; the first is the destination's
// own route. A page that gains or loses a tab changes its row here.
export const destinationViews: Partial<
  Record<DestinationKey, readonly DestinationView[]>
> = {
  transactions: [
    {
      key: "transactions.all",
      label: "transactions.tab.all",
      to: "/transactions",
    },
    {
      key: "transactions.queue",
      label: "transactions.tab.uncategorized",
      to: "/transactions",
      search: { uncategorized: true },
    },
  ],
  categories: [
    {
      key: "categories.categories",
      label: "categories.tab.categories",
      to: "/categories",
    },
    {
      key: "categories.rules",
      label: "categories.tab.rules",
      to: "/categories/rules",
    },
    {
      key: "categories.payees",
      label: "categories.tab.payees",
      to: "/categories/payees",
    },
    {
      key: "categories.tags",
      label: "categories.tab.tags",
      to: "/categories/tags",
    },
  ],
  accounts: [
    {
      key: "accounts.accounts",
      label: "accounts.tab.accounts",
      to: "/accounts",
    },
    {
      key: "accounts.institutions",
      label: "accounts.tab.institutions",
      to: "/accounts/institutions",
    },
    {
      key: "accounts.links",
      label: "accounts.tab.links",
      to: "/accounts/links",
    },
  ],
  planning: [
    { key: "planning.agenda", label: "planning.tab.agenda", to: "/planning" },
    {
      key: "planning.schedules",
      label: "planning.tab.schedules",
      to: "/planning",
      search: { tab: "schedules" },
    },
    {
      key: "planning.subscriptions",
      label: "planning.tab.subscriptions",
      to: "/planning",
      search: { tab: "subscriptions" },
    },
    {
      key: "planning.budgets",
      label: "planning.tab.budgets",
      to: "/planning",
      search: { tab: "budgets" },
    },
  ],
  reports: [
    { key: "reports.net-worth", label: "report.tab.netWorth", to: "/reports" },
    {
      key: "reports.categories",
      label: "report.tab.categories",
      to: "/reports",
      search: { tab: "categories" },
    },
    {
      key: "reports.flows",
      label: "report.tab.flows",
      to: "/reports",
      search: { tab: "flows" },
    },
    {
      key: "reports.indicators",
      label: "report.tab.indicators",
      to: "/reports",
      search: { tab: "indicators" },
    },
  ],
};

const views = Object.values(destinationViews).flat();

// The view whose route equals the pathname and whose search the location holds; among several,
// the one that names the most search values, so a tab wins over the page's first view.
export function matchView(
  pathname: string,
  search: Readonly<Record<string, unknown>>,
): DestinationView | undefined {
  let best: DestinationView | undefined;

  for (const view of views) {
    const wanted = Object.entries(view.search ?? {});
    const matches =
      view.to === pathname &&
      wanted.every(([name, value]) => search[name] === value);

    if (matches && wanted.length >= Object.keys(best?.search ?? {}).length) {
      best = best !== undefined && wanted.length === 0 ? best : view;
    }
  }

  return best;
}

export function viewHref(view: DestinationView): string {
  const query = Object.entries(view.search ?? {})
    .map(([name, value]) => `${name}=${encodeURIComponent(String(value))}`)
    .join("&");

  return query === "" ? view.to : `${view.to}?${query}`;
}
