import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig, type Plugin } from "vite";
import { configDefaults } from "vitest/config";

// The loader of this file reads no alias.
// eslint-disable-next-line no-restricted-imports
import { skipEqualValues } from "./src/features/spreadsheets/editor/univer-equal-values.ts";

// @slotted/react 0.1.0-beta.2 bundles a CommonJS copy of react-dom that calls
// require("react"), which throws in the browser. The chunk is replaced by the
// application's react-dom, keeping the lazy getter it exports as `t`.
const slottedReactDOM: Plugin = {
  name: "equori:slotted-react-dom",
  load(id) {
    if (/@slotted\/react\/dist\/react-dom-[\w-]+\.js$/.test(id)) {
      return 'import * as ReactDOM from "react-dom";\nexport const t = () => ReactDOM;\n';
    }
    return null;
  },
};

// The spreadsheet editor draws its toolbar again only for values that changed (ADR 038, E14).
const univerEqualValues: Plugin = {
  name: "equori:univer-equal-values",
  transform: {
    filter: { id: /@univerjs\/ui\/lib\/es\/index\.js/ },
    handler: (code) => ({ code: skipEqualValues(code), map: null }),
  },
};

export default defineConfig({
  plugins: [react(), tailwindcss(), slottedReactDOM, univerEqualValues],
  optimizeDeps: {
    // The spreadsheet editor is imported on demand, so the dev server would find its packages
    // on the first opening of a spreadsheet, bundle them then and reload the page. Listed here,
    // they are bundled when the server starts.
    include: [
      "@univerjs/presets",
      "@univerjs/preset-sheets-core",
      "@univerjs/preset-sheets-conditional-formatting",
      "@univerjs/preset-sheets-data-validation",
      "@univerjs/preset-sheets-drawing",
      "@univerjs/preset-sheets-filter",
      "@univerjs/preset-sheets-find-replace",
      "@univerjs/preset-sheets-hyper-link",
      "@univerjs/preset-sheets-note",
      "@univerjs/preset-sheets-sort",
      "@univerjs/preset-sheets-table",
      "@univerjs/preset-sheets-core/locales/en-US",
      "@univerjs/preset-sheets-core/locales/pt-BR",
      "@univerjs/preset-sheets-conditional-formatting/locales/en-US",
      "@univerjs/preset-sheets-conditional-formatting/locales/pt-BR",
      "@univerjs/preset-sheets-data-validation/locales/en-US",
      "@univerjs/preset-sheets-data-validation/locales/pt-BR",
      "@univerjs/preset-sheets-drawing/locales/en-US",
      "@univerjs/preset-sheets-drawing/locales/pt-BR",
      "@univerjs/preset-sheets-filter/locales/en-US",
      "@univerjs/preset-sheets-filter/locales/pt-BR",
      "@univerjs/preset-sheets-find-replace/locales/en-US",
      "@univerjs/preset-sheets-find-replace/locales/pt-BR",
      "@univerjs/preset-sheets-hyper-link/locales/en-US",
      "@univerjs/preset-sheets-hyper-link/locales/pt-BR",
      "@univerjs/preset-sheets-note/locales/en-US",
      "@univerjs/preset-sheets-note/locales/pt-BR",
      "@univerjs/preset-sheets-sort/locales/en-US",
      "@univerjs/preset-sheets-sort/locales/pt-BR",
      "@univerjs/preset-sheets-table/locales/en-US",
      "@univerjs/preset-sheets-table/locales/pt-BR",
      "fflate",
    ],
    rolldownOptions: { plugins: [slottedReactDOM, univerEqualValues] },
  },
  // tsconfig.json paths are the single definition of the @/ alias.
  resolve: { tsconfigPaths: true },
  server: {
    // Reachable from other devices on the LAN, such as a phone.
    host: "0.0.0.0",
    // mDNS names of a development server on the LAN, such as devserver.local, and MagicDNS
    // names of a tailnet, such as dev-server-0.taild3dcad.ts.net.
    allowedHosts: [".local", ".ts.net"],
    // Vite ignores its output directory only when it empties it; with emptyOutDir off, a build
    // beside the dev server would reload the page once per file it writes.
    watch: { ignored: ["**/web/dist/**"] },
    // The shell and what it imports are transformed at start, before the first request asks.
    warmup: { clientFiles: ["./src/main.tsx"] },
    // make dev serves the API; one origin lets the session cookie through without CORS.
    // Over plain HTTP on a LAN address the browser sends no Sec-Fetch-Site, so the
    // backend's cross-origin protection compares Origin with Host; both name the target.
    proxy: {
      "/api": {
        target: "http://127.0.0.1:8080",
        changeOrigin: true,
        headers: { origin: "http://127.0.0.1:8080" },
      },
      // The MCP endpoint (ADR 024) sits outside /api/; a client that reaches the Vite address uses it too.
      "/mcp": {
        target: "http://127.0.0.1:8080",
        changeOrigin: true,
      },
    },
  },
  test: {
    environment: "jsdom",
    // The glass style is blocked in a build without this variable (theme/visual.ts); the tests of
    // the style run with it on.
    env: { VITE_EXPERIMENTAL_GLASS: "on" },
    // Screens that render a whole page take about 5 s on a loaded machine, the default limit.
    testTimeout: 15_000,
    setupFiles: ["src/testing/setup.ts"],
    // @slotted/react ships a CommonJS react-dom shim that needs the Vite transform.
    server: { deps: { inline: [/@slotted\//] } },
    exclude: [
      ...configDefaults.exclude,
      "src/theme/equori.theme.test.ts",
      "src/theme/equori-glass.theme.test.ts",
      "src/theme/equori-glass-table.theme.test.ts",
      "src/theme/surface-recipe.theme.test.ts",
      "src/testing/slotted-issues.test.ts",
    ],
  },
  build: {
    // web/dist/.gitkeep must survive the build; make web-build cleans the rest.
    emptyOutDir: false,
    // ADR 028 serves the page under default-src 'self', which refuses data: images; an
    // institution logo (ADR 013) is always emitted as a file, however small.
    assetsInlineLimit: (file) =>
      file.includes("/logos-bancos-br/") ? false : undefined,
  },
});
