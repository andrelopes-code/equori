import { lazyRouteComponent } from "@tanstack/react-router";

export const InstrumentsPage = lazyRouteComponent(
  () => import("@/features/instruments/pages/instruments-page"),
  "InstrumentsPage",
);

export const InstrumentPage = lazyRouteComponent(
  () => import("@/features/instruments/pages/instrument-page"),
  "InstrumentPage",
);
