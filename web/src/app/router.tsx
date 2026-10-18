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
import type { Client } from "openapi-fetch";
import { useEffect } from "react";

import { useApi } from "@/api/api-context";
import type { paths } from "@/api/schema.gen";
import { ProblemError } from "@/api/problem";
import { Placeholder } from "@/app/placeholder";
import { useSessionExpiry } from "@/app/providers";
import { AppFrame } from "@/app/shell/app-frame";
import { AccountsPage, HomePage } from "@/features/accounts";
import { LoginPage, meQuery } from "@/features/session";
import {
  CorrectTransactionPage,
  NewTransactionPage,
  TransactionPage,
  TransactionsPage,
  validateTransactionSearch,
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

const screen = <P extends string>(path: P) =>
  createRoute({
    getParentRoute: () => authedRoute,
    path,
    component: Placeholder,
  });

const homeRoute = createRoute({
  getParentRoute: () => authedRoute,
  path: "/",
  component: HomePage,
});

const transactionsRoute = createRoute({
  getParentRoute: () => authedRoute,
  path: "transactions",
  validateSearch: validateTransactionSearch,
  component: TransactionsPage,
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
    accountsRoute,
    screen("accounts/$id"),
    screen("settings"),
  ]),
]);

// RouterProvider supplies the real context (see AppRouter), so the router starts with an empty one.
export function newRouter(history?: RouterHistory) {
  return createRouter({
    routeTree,
    context: {} as RouterContext,
    ...(history === undefined ? {} : { history }),
    defaultPreload: "intent",
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
        queryClient.clear();
        const { pathname, href } = router.state.location;
        if (pathname === "/login") return;
        void router.navigate({ to: "/login", search: { redirect: href } });
      }),
    [expiry, queryClient, router],
  );
  return <RouterProvider router={router} context={{ api, queryClient }} />;
}
