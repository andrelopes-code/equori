import { useQueryClient } from "@tanstack/react-query";
import type { QueryClient } from "@tanstack/react-query";
import {
  RouterProvider,
  createRootRouteWithContext,
  createRoute,
  createRouter,
  Outlet,
} from "@tanstack/react-router";
import type { RouterHistory } from "@tanstack/react-router";
import type { Client } from "openapi-fetch";

import { useApi } from "@/api/api-context";
import type { paths } from "@/api/schema.gen";
import { Placeholder } from "@/app/placeholder";
import { AppFrame } from "@/app/shell/app-frame";

export interface RouterContext {
  queryClient: QueryClient;
  api: Client<paths>;
}

const rootRoute = createRootRouteWithContext<RouterContext>()({
  component: Outlet,
});

const loginRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/login",
  validateSearch: (search): { redirect?: string } =>
    typeof search.redirect === "string" && search.redirect.startsWith("/")
      ? { redirect: search.redirect }
      : {},
  component: Placeholder,
});

const authedRoute = createRoute({
  getParentRoute: () => rootRoute,
  id: "_authed",
  component: AppFrame,
});

const screen = <P extends string>(path: P) =>
  createRoute({
    getParentRoute: () => authedRoute,
    path,
    component: Placeholder,
  });

export const routeTree = rootRoute.addChildren([
  loginRoute,
  authedRoute.addChildren([
    screen("/"),
    screen("transactions"),
    screen("transactions/new"),
    screen("transactions/$id"),
    screen("transactions/$id/correct"),
    screen("accounts"),
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
  return <RouterProvider router={router} context={{ api, queryClient }} />;
}
