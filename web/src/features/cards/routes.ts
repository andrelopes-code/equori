import { lazyRouteComponent } from "@tanstack/react-router";

export {
  phoneCardTabs,
  validateCardSearch,
} from "@/features/cards/model/card-search";
export { validateStatementSearch } from "@/features/cards/pages/statement-search";

export const CardPage = lazyRouteComponent(
  () => import("@/features/cards/pages/card-page"),
  "CardPage",
);

export const CardsPage = lazyRouteComponent(
  () => import("@/features/cards/pages/cards-page"),
  "CardsPage",
);

export const StatementPage = lazyRouteComponent(
  () => import("@/features/cards/pages/statement-page"),
  "StatementPage",
);

// Pure, so a production build, which draws no preview, drops the page too.
export const CardFacePreview = /* @__PURE__ */ lazyRouteComponent(
  () => import("@/features/cards/pages/card-face-preview"),
  "CardFacePreview",
);
