import { lazyRouteComponent } from "@tanstack/react-router";

// Pure, so a production build, which draws no preview, drops the page too.
export const AnswersPreview = /* @__PURE__ */ lazyRouteComponent(
  () => import("@/features/assistant/preview/answers-preview"),
  "AnswersPreview",
);
