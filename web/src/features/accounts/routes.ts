import { lazyRouteComponent } from "@tanstack/react-router";

export { validateAccountFormSearch } from "@/features/accounts/account-form/account-form-search";
export { validateAccountsSearch } from "@/features/accounts/pages/accounts-search";
export {
  phoneAccountTabs,
  validateAccountSearch,
} from "@/features/accounts/model/account-search";
export { validateBatchSearch } from "@/features/accounts/batch/batch-search";
export { validateLinksSearch } from "@/features/accounts/links/links-search";

export const AccountsPage = lazyRouteComponent(
  () => import("@/features/accounts/pages/accounts-page"),
  "AccountsPage",
);

export const AccountPage = lazyRouteComponent(
  () => import("@/features/accounts/pages/account-page"),
  "AccountPage",
);

export const InstitutionsPage = lazyRouteComponent(
  () => import("@/features/accounts/pages/institutions-page"),
  "InstitutionsPage",
);

export const NewAccountPage = lazyRouteComponent(
  () => import("@/features/accounts/pages/new-account-page"),
  "NewAccountPage",
);

export const EditAccountPage = lazyRouteComponent(
  () => import("@/features/accounts/pages/edit-account-page"),
  "EditAccountPage",
);

export const ImportPage = lazyRouteComponent(
  () => import("@/features/accounts/pages/import-page"),
  "ImportPage",
);

export const BatchPage = lazyRouteComponent(
  () => import("@/features/accounts/pages/batch-page"),
  "BatchPage",
);

export const LinksPage = lazyRouteComponent(
  () => import("@/features/accounts/pages/links-page"),
  "LinksPage",
);

export const AccountsLayout = lazyRouteComponent(
  () => import("@/features/accounts/accounts-header/accounts-layout"),
  "AccountsLayout",
);

// Pure, so a production build, which draws no preview, drops the page too.
export const AccountCardPreview = /* @__PURE__ */ lazyRouteComponent(
  () => import("@/features/accounts/account-card/account-card-preview"),
  "AccountCardPreview",
);
