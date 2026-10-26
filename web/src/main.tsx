import "@/app/app.css";
import "@slotted/react/styles.css";
import "@fontsource-variable/geist";
import "@fontsource-variable/geist-mono";
import "@/theme/equori.gen.css";

import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { AuroraBackground } from "@/app/aurora-background";
import { AppProviders } from "@/app/providers";
import { AppRouterProvider, newRouter } from "@/app/router";
import { registerServiceWorker } from "@/app/service-worker";
import { guardTouchContextMenu } from "@/app/touch-context-menu";
import { applyAccent, readAccent } from "@/theme/accent";
import { applyCorners, readCorners } from "@/theme/corners";
import { applyScheme, readScheme } from "@/theme/scheme";
import { restoreVisual } from "@/theme/visual";

applyScheme(readScheme());
applyAccent(readAccent());
applyCorners(readCorners());
restoreVisual();
guardTouchContextMenu(document);

const router = newRouter();

const root = document.getElementById("root");
if (root === null) {
  throw new Error("missing #root element");
}

createRoot(root).render(
  <StrictMode>
    <AuroraBackground />
    <AppProviders>
      <AppRouterProvider router={router} />
    </AppProviders>
  </StrictMode>,
);

registerServiceWorker({
  prod: import.meta.env.PROD,
  secure: window.isSecureContext,
  container: navigator.serviceWorker,
});
