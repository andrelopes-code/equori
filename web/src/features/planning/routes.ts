import { lazyRouteComponent } from "@tanstack/react-router";

export {
  validateBudgetFormSearch,
  validateBudgetSearch,
  validatePlanningSearch,
  validateScheduleFormSearch,
} from "@/features/planning/model/planning-search";

export const PlanningPage = lazyRouteComponent(
  () => import("@/features/planning/pages/planning-page"),
  "PlanningPage",
);

export const BudgetPage = lazyRouteComponent(
  () => import("@/features/planning/pages/budget-page"),
  "BudgetPage",
);

export const BudgetFormPage = lazyRouteComponent(
  () => import("@/features/planning/pages/budget-form-page"),
  "BudgetFormPage",
);

export const SchedulePage = lazyRouteComponent(
  () => import("@/features/planning/pages/schedule-page"),
  "SchedulePage",
);

export const ScheduleFormPage = lazyRouteComponent(
  () => import("@/features/planning/pages/schedule-form-page"),
  "ScheduleFormPage",
);
