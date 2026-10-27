import { useQueryClient } from "@tanstack/react-query";
import type { QueryClient } from "@tanstack/react-query";
import {
  RouterProvider,
  createRootRouteWithContext,
  createRoute,
  createRouter,
  notFound,
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
import {
  AccountPage,
  AccountsLayout,
  AccountsPage,
  BatchPage,
  EditAccountPage,
  ImportPage,
  InstitutionsPage,
  LinksPage,
  NewAccountPage,
  validateAccountFormSearch,
  validateAccountSearch,
  validateBatchSearch,
  validateLinksSearch,
  validateAccountsSearch,
  AccountCardPreview,
} from "@/features/accounts";
import { InstrumentPage, InstrumentsPage } from "@/features/instruments";
import {
  PortfolioPage,
  PortfolioYearPage,
  validatePortfolioSearch,
  validateYearSearch,
} from "@/features/portfolio";
import { ReportsPage, validateReportsSearch } from "@/features/reports";
import {
  CalculatorPage,
  CalculatorsPage,
  isCalculatorId,
  validateCalculatorSearch,
} from "@/features/calculators";
import { OverviewPage } from "@/features/overview";
import {
  CardPage,
  CardsPage,
  StatementPage,
  validateCardSearch,
  validateStatementSearch,
} from "@/features/cards";
import {
  CategoriesPage,
  PayeesPage,
  TagsPage,
  RuleEditorPage,
  RulesPage,
  validateCategoriesSearch,
  validateRulePrefill,
} from "@/features/categories";
import { GoalsPage } from "@/features/goals";
import {
  BudgetFormPage,
  BudgetPage,
  PlanningPage,
  ScheduleFormPage,
  SchedulePage,
  validateBudgetFormSearch,
  validateBudgetSearch,
  validatePlanningSearch,
} from "@/features/planning";
import { LoginPage, meQuery, rememberDeviceUser } from "@/features/session";
import { SettingsPage, validateSettingsSearch } from "@/features/setup";
import {
  CapturePage,
  CaptureQueuePage,
  CorrectTransactionPage,
  NewTransactionPage,
  OfflinePage,
  TransactionPage,
  TransactionsPage,
  isBuiltKind,
  validateCaptureSearch,
  validateTransactionSearch,
  validateTransactionsPageSearch,
} from "@/features/transactions";
import type { BuiltKind } from "@/features/transactions";

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

const offlineRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/offline",
  component: OfflinePage,
});

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
      const me = await context.queryClient.query({
        ...meQuery(context.api),
        staleTime: "static",
        // One retry: a start without the server should reach /offline in seconds. A Problem below
        // 500, such as the 401 of a signed-out visitor, is not retried (query-client.ts).
        retry: (count, error) =>
          !(error instanceof ProblemError && error.status < 500) && count < 1,
      });
      rememberDeviceUser({ id: me.id, email: me.email });
    } catch (error) {
      if (error instanceof ProblemError && error.status === 401) {
        // eslint-disable-next-line @typescript-eslint/only-throw-error -- TanStack Router redirects are thrown objects.
        throw redirect({ to: "/login", search: { redirect: location.href } });
      }
      // fetch rejects with a TypeError when no HTTP answer arrives (P3 of ADR 022).
      if (error instanceof TypeError) {
        // eslint-disable-next-line @typescript-eslint/only-throw-error -- TanStack Router redirects are thrown objects.
        throw redirect({ to: "/offline" });
      }
      throw error;
    }
  },
  component: AppFrame,
});

const settingsRoute = createRoute({
  getParentRoute: () => authedRoute,
  path: "settings",
  validateSearch: validateSettingsSearch,
  component: SettingsPage,
});

const accountRoute = createRoute({
  getParentRoute: () => authedRoute,
  path: "accounts/$id",
  validateSearch: validateAccountSearch,
  // A failed chunk load falls to the Chart error state instead of the route error screen.
  loader: () => preloadChartEngine(["line"]).catch(() => undefined),
  component: AccountPage,
});

const institutionsRoute = createRoute({
  getParentRoute: () => accountsLayoutRoute,
  path: "institutions",
  component: InstitutionsPage,
});

const newAccountRoute = createRoute({
  getParentRoute: () => authedRoute,
  path: "accounts/new",
  validateSearch: validateAccountFormSearch,
  component: NewAccountPage,
});

const editAccountRoute = createRoute({
  getParentRoute: () => authedRoute,
  path: "accounts/$id/edit",
  component: EditAccountPage,
});

const importRoute = createRoute({
  getParentRoute: () => authedRoute,
  path: "accounts/$id/import",
  component: ImportPage,
});

const batchRoute = createRoute({
  getParentRoute: () => authedRoute,
  path: "accounts/$id/imports/$batchId",
  validateSearch: validateBatchSearch,
  component: BatchPage,
});

const linksRoute = createRoute({
  getParentRoute: () => accountsLayoutRoute,
  path: "links",
  validateSearch: validateLinksSearch,
  component: LinksPage,
});

const cardsRoute = createRoute({
  getParentRoute: () => authedRoute,
  path: "cards",
  component: CardsPage,
});

const cardRoute = createRoute({
  getParentRoute: () => authedRoute,
  path: "cards/$accountId",
  validateSearch: validateCardSearch,
  component: CardPage,
});

const statementRoute = createRoute({
  getParentRoute: () => authedRoute,
  path: "cards/$accountId/statements/$statementId",
  validateSearch: validateStatementSearch,
  component: StatementPage,
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

const categoriesRoute = createRoute({
  getParentRoute: () => authedRoute,
  path: "categories",
  validateSearch: validateCategoriesSearch,
  component: CategoriesPage,
});

const rulesRoute = createRoute({
  getParentRoute: () => authedRoute,
  path: "categories/rules",
  component: RulesPage,
});

const newRuleRoute = createRoute({
  getParentRoute: () => authedRoute,
  path: "categories/rules/new",
  validateSearch: validateRulePrefill,
  component: RuleEditorPage,
});

const ruleRoute = createRoute({
  getParentRoute: () => authedRoute,
  path: "categories/rules/$id",
  component: RuleEditorPage,
});

const payeesRoute = createRoute({
  getParentRoute: () => authedRoute,
  path: "categories/payees",
  component: PayeesPage,
});

const tagsRoute = createRoute({
  getParentRoute: () => authedRoute,
  path: "categories/tags",
  component: TagsPage,
});

const goalsRoute = createRoute({
  getParentRoute: () => authedRoute,
  path: "goals",
  component: GoalsPage,
});

const planningRoute = createRoute({
  getParentRoute: () => authedRoute,
  path: "planning",
  validateSearch: validatePlanningSearch,
  component: PlanningPage,
});

const newScheduleRoute = createRoute({
  getParentRoute: () => authedRoute,
  path: "planning/schedules/new",
  component: ScheduleFormPage,
});

const scheduleRoute = createRoute({
  getParentRoute: () => authedRoute,
  path: "planning/schedules/$id",
  component: SchedulePage,
});

const newBudgetRoute = createRoute({
  getParentRoute: () => authedRoute,
  path: "planning/budgets/new",
  validateSearch: validateBudgetFormSearch,
  component: BudgetFormPage,
});

const budgetRoute = createRoute({
  getParentRoute: () => authedRoute,
  path: "planning/budgets/$id",
  validateSearch: validateBudgetSearch,
  component: BudgetPage,
});

const instrumentsRoute = createRoute({
  getParentRoute: () => authedRoute,
  path: "instruments",
  component: InstrumentsPage,
});

const instrumentRoute = createRoute({
  getParentRoute: () => authedRoute,
  path: "instruments/$code",
  // A failed chunk load falls to the Chart error state instead of the route error screen.
  loader: () => preloadChartEngine(["line"]).catch(() => undefined),
  component: InstrumentPage,
});

const portfolioRoute = createRoute({
  getParentRoute: () => authedRoute,
  path: "portfolio",
  validateSearch: validatePortfolioSearch,
  component: PortfolioPage,
});

const portfolioYearRoute = createRoute({
  getParentRoute: () => authedRoute,
  path: "portfolio/year",
  validateSearch: validateYearSearch,
  component: PortfolioYearPage,
});

const reportsRoute = createRoute({
  getParentRoute: () => authedRoute,
  path: "reports",
  validateSearch: validateReportsSearch,
  component: ReportsPage,
});

const calculatorsRoute = createRoute({
  getParentRoute: () => authedRoute,
  path: "calculators",
  component: CalculatorsPage,
});

const calculatorRoute = createRoute({
  getParentRoute: () => authedRoute,
  path: "calculators/$id",
  // Declared without keys: an index signature would join the search type of every route and
  // retype their keys. The values are strings (validateCalculatorSearch).
  validateSearch: (raw): object => validateCalculatorSearch(raw),
  beforeLoad: ({ params }) => {
    // eslint-disable-next-line @typescript-eslint/only-throw-error -- TanStack Router not-found results are thrown objects.
    if (!isCalculatorId(params.id)) throw notFound();
  },
  // A failed chunk load falls to the Chart error state instead of the route error screen.
  loader: () => preloadChartEngine(["line"]).catch(() => undefined),
  component: CalculatorPage,
});

const accountsLayoutRoute = createRoute({
  getParentRoute: () => authedRoute,
  path: "accounts",
  component: AccountsLayout,
});

const accountsRoute = createRoute({
  getParentRoute: () => accountsLayoutRoute,
  path: "/",
  validateSearch: validateAccountsSearch,
  component: AccountsPage,
});

const newTransactionRoute = createRoute({
  getParentRoute: () => authedRoute,
  path: "transactions/new",
  validateSearch: (search): { account_id?: string; kind?: BuiltKind } => {
    const { account_id } = validateTransactionSearch(search);
    return {
      ...(account_id === undefined ? {} : { account_id }),
      ...(isBuiltKind(search.kind) ? { kind: search.kind } : {}),
    };
  },
  component: NewTransactionPage,
});

const captureRoute = createRoute({
  getParentRoute: () => authedRoute,
  path: "transactions/capture",
  validateSearch: validateCaptureSearch,
  component: CapturePage,
});

const captureQueueRoute = createRoute({
  getParentRoute: () => authedRoute,
  path: "transactions/queue",
  component: CaptureQueuePage,
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

// Pages that check an element in isolation; a production build drops the branch and the pages.
const previewRoutes = import.meta.env.DEV
  ? [
      createRoute({
        getParentRoute: () => rootRoute,
        path: "/preview/account-card",
        component: AccountCardPreview,
      }),
    ]
  : [];

export const routeTree = rootRoute.addChildren([
  loginRoute,
  offlineRoute,
  ...previewRoutes,
  authedRoute.addChildren([
    homeRoute,
    transactionsRoute,
    newTransactionRoute,
    captureRoute,
    captureQueueRoute,
    transactionRoute,
    correctTransactionRoute,
    categoriesRoute,
    rulesRoute,
    newRuleRoute,
    ruleRoute,
    payeesRoute,
    tagsRoute,
    goalsRoute,
    planningRoute,
    newScheduleRoute,
    scheduleRoute,
    newBudgetRoute,
    budgetRoute,
    accountsLayoutRoute.addChildren([
      accountsRoute,
      institutionsRoute,
      linksRoute,
    ]),
    newAccountRoute,
    accountRoute,
    editAccountRoute,
    importRoute,
    batchRoute,
    cardsRoute,
    cardRoute,
    statementRoute,
    instrumentsRoute,
    portfolioRoute,
    portfolioYearRoute,
    reportsRoute,
    calculatorsRoute,
    calculatorRoute,
    instrumentRoute,
    settingsRoute,
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
