import "@/app/app.css";
import "@slotted/react/styles.css";
import "@/theme/equori.gen.css";

import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { App } from "@/app";
import { applyScheme, readScheme } from "@/theme/scheme";

applyScheme(readScheme());

const root = document.getElementById("root");
if (root === null) {
  throw new Error("missing #root element");
}

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
