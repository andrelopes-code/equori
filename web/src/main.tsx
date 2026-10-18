import "@/app/app.css";
import "@slotted/react/styles.css";
import "@fontsource-variable/geist";
import "@fontsource-variable/geist-mono";
import "@/theme/equori.gen.css";

import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { AppProviders } from "@/app/providers";
import { AppRouterProvider, newRouter } from "@/app/router";
import { applyScheme, readScheme } from "@/theme/scheme";

applyScheme(readScheme());

const router = newRouter();

const root = document.getElementById("root");
if (root === null) {
  throw new Error("missing #root element");
}

createRoot(root).render(
  <StrictMode>
    <AppProviders>
      <AppRouterProvider router={router} />
    </AppProviders>
  </StrictMode>,
);
