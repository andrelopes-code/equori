import { lazyRouteComponent } from "@tanstack/react-router";

export { validateCategoriesSearch } from "@/features/categories/pages/categories-search";
export { validateRulePrefill } from "@/features/categories/pages/rule-prefill";

export const CategoriesPage = lazyRouteComponent(
  () => import("@/features/categories/pages/categories-page"),
  "CategoriesPage",
);

export const RulesPage = lazyRouteComponent(
  () => import("@/features/categories/pages/rules-page"),
  "RulesPage",
);

export const PayeesPage = lazyRouteComponent(
  () => import("@/features/categories/pages/payees-page"),
  "PayeesPage",
);

export const TagsPage = lazyRouteComponent(
  () => import("@/features/categories/pages/tags-page"),
  "TagsPage",
);

export const RuleEditorPage = lazyRouteComponent(
  () => import("@/features/categories/pages/rule-editor-page"),
  "RuleEditorPage",
);
