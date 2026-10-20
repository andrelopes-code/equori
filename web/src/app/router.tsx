import { useQueryClient } from "@tanstack/react-query";
import type { QueryClient } from "@tanstack/react-query";
import {
  RouterProvider,
  createRootRouteWithContext,
  createRoute,
  createRouter,
  Outlet,
  redirect,
} from "@tanstack/react-router";
import type { RouterHistory } from "@tanstack/react-router";
import { preloadChartEngine } from "@slotted/react/chart";
import type { Client } from "openapi-fetch";
import { useEffect } from "react";

import { useApi } from "@/api/api-context";
import type { paths } from "@/api/schema.gen";
import { ProblemError } from "@/api/problem";
import { useSessionExpiry } from "@/app/providers";
import { RouteError } from "@/app/route-error";
import { RouteNotFound } from "@/app/route-not-found";
import { AppFrame } from "@/app/shell/app-frame";
import { AccountPage, AccountsPage } from "@/features/accounts";
import { AdminPage } from "@/features/admin";
import { OverviewPage } from "@/features/overview";
import { CardOverviewPage, CardsPage } from "@/features/cards";
import { GoalsPage } from "@/features/goals";
import { LoginPage, meQuery } from "@/features/session";
import { SettingsPage } from "@/features/setup";
import {
  CorrectTransactionPage,
  NewTransactionPage,
  TransactionPage,
  TransactionsPage,
  validateTransactionSearch,
  validateTransactionsPageSearch,
} from "@/features/transactions";

export interface RouterContext {
  queryClient: QueryClient;
  api: Client<paths>;
}

const rootRoute = createRootRouteWithContext<RouterContext>()({
  component: Outlet,
});

// Rejects "//" and "/\\" (scheme-relative URLs) and control characters, which browsers strip: "/\t/evil" becomes "//evil".
function isLocalPath(path: string): boolean {
  // eslint-disable-next-line no-control-regex -- the control characters are the subject of the check.
  return /^\/(?![/\\])/.test(path) && !/[\u0000-\u001f\u007f]/.test(path);
}

const loginRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/login",
  // The key is returned as undefined, not omitted: the router keeps raw keys the validator leaves out.
  validateSearch: (search): { redirect: string | undefined } => ({
    redirect:
      typeof search.redirect === "string" && isLocalPath(search.redirect)
        ? search.redirect
        : undefined,
  }),
  component: LoginPage,
});

const authedRoute = createRoute({
  getParentRoute: () => rootRoute,
  id: "_authed",
  beforeLoad: async ({ context, location }) => {
    try {
      await context.queryClient.query({
        ...meQuery(context.api),
        staleTime: "static",
      });
    } catch (error) {
      if (error instanceof ProblemError && error.status === 401) {
        // eslint-disable-next-line @typescript-eslint/only-throw-error -- TanStack Router redirects are thrown objects.
        throw redirect({ to: "/login", search: { redirect: location.href } });
      }
      throw error;
    }
  },
  component: AppFrame,
});

const settingsRoute = createRoute({
  getParentRoute: () => authedRoute,
  path: "settings",
  component: SettingsPage,
});

const accountRoute = createRoute({
  getParentRoute: () => authedRoute,
  path: "accounts/$id",
  // A failed chunk load falls to the Chart error state instead of the route error screen.
  loader: () => preloadChartEngine(["line"]).catch(() => undefined),
  component: AccountPage,
});

const cardsRoute = createRoute({
  getParentRoute: () => authedRoute,
  path: "cards",
  component: CardsPage,
});

const cardRoute = createRoute({
  getParentRoute: () => authedRoute,
  path: "cards/$accountId",
  validateSearch: (search): { from?: string } =>
    typeof search.from === "string" &&
    /^\d{4}-(0[1-9]|1[0-2])$/.test(search.from)
      ? { from: search.from }
      : {},
  component: CardOverviewPage,
});

const homeRoute = createRoute({
  getParentRoute: () => authedRoute,
  path: "/",
  validateSearch: (search): { month?: string } =>
    typeof search.month === "string" &&
    /^\d{4}-(0[1-9]|1[0-2])$/.test(search.month)
      ? { month: search.month }
      : {},
  component: OverviewPage,
});

const transactionsRoute = createRoute({
  getParentRoute: () => authedRoute,
  path: "transactions",
  validateSearch: validateTransactionsPageSearch,
  component: TransactionsPage,
});

const goalsRoute = createRoute({
  getParentRoute: () => authedRoute,
  path: "goals",
  component: GoalsPage,
});

const adminRoute = createRoute({
  getParentRoute: () => authedRoute,
  path: "admin",
  component: AdminPage,
});

const accountsRoute = createRoute({
  getParentRoute: () => authedRoute,
  path: "accounts",
  component: AccountsPage,
});

const newTransactionRoute = createRoute({
  getParentRoute: () => authedRoute,
  path: "transactions/new",
  validateSearch: (search): { account_id?: string } => {
    const { account_id } = validateTransactionSearch(search);
    return account_id === undefined ? {} : { account_id };
  },
  component: NewTransactionPage,
});

const transactionRoute = createRoute({
  getParentRoute: () => authedRoute,
  path: "transactions/$id",
  component: TransactionPage,
});

const correctTransactionRoute = createRoute({
  getParentRoute: () => authedRoute,
  path: "transactions/$id/correct",
  component: CorrectTransactionPage,
});

export const routeTree = rootRoute.addChildren([
  loginRoute,
  authedRoute.addChildren([
    homeRoute,
    transactionsRoute,
    newTransactionRoute,
    transactionRoute,
    correctTransactionRoute,
    goalsRoute,
    accountsRoute,
    accountRoute,
    cardsRoute,
    cardRoute,
    settingsRoute,
    adminRoute,
  ]),
]);

// RouterProvider supplies the real context (see AppRouter), so the router starts with an empty one.
export function newRouter(history?: RouterHistory) {
  return createRouter({
    routeTree,
    context: {} as RouterContext,
    ...(history === undefined ? {} : { history }),
    defaultPreload: "intent",
    defaultErrorComponent: RouteError,
    defaultNotFoundComponent: RouteNotFound,
  });
}

export type AppRouter = ReturnType<typeof newRouter>;

declare module "@tanstack/react-router" {
  interface Register {
    router: AppRouter;
  }
}

export function AppRouterProvider({ router }: { router: AppRouter }) {
  const api = useApi();
  const queryClient = useQueryClient();
  const expiry = useSessionExpiry();
  useEffect(
    () =>
      expiry.install(() => {
        const { pathname, href } = router.state.location;
        if (pathname === "/login") {
          queryClient.clear();
          return;
        }
        // The shell's own queries refill a cache cleared while it is still mounted,
        // so the cache is cleared once the login route has replaced it.
        void router
          .navigate({ to: "/login", search: { redirect: href } })
          .then(() => {
            queryClient.clear();
          });
      }),
    [expiry, queryClient, router],
  );
  return <RouterProvider router={router} context={{ api, queryClient }} />;
}
