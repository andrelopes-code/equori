import react from "@vitejs/plugin-react";
import { defineConfig, type Plugin } from "vite";
import { configDefaults } from "vitest/config";

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

export default defineConfig({
  plugins: [react(), slottedReactDOM],
  optimizeDeps: { rolldownOptions: { plugins: [slottedReactDOM] } },
  // tsconfig.json paths are the single definition of the @/ alias.
  resolve: { tsconfigPaths: true },
  server: {
    // mDNS names of a development server on the LAN, such as devserver.local.
    allowedHosts: [".local"],
    // make dev serves the API; one origin lets the session cookie through without CORS.
    // Over plain HTTP on a LAN address the browser sends no Sec-Fetch-Site, so the
    // backend's cross-origin protection compares Origin with Host; both name the target.
    proxy: {
      "/api": {
        target: "http://127.0.0.1:8080",
        changeOrigin: true,
        headers: { origin: "http://127.0.0.1:8080" },
      },
    },
  },
  test: {
    environment: "jsdom",
    // Screens that render a whole page take about 5 s on a loaded machine, the default limit.
    testTimeout: 15_000,
    setupFiles: ["src/testing/setup.ts"],
    // @slotted/react ships a CommonJS react-dom shim that needs the Vite transform.
    server: { deps: { inline: [/@slotted\//] } },
    exclude: [...configDefaults.exclude, "src/theme/equori.theme.test.ts"],
  },
  build: {
    // web/dist/.gitkeep must survive the build; make web-build cleans the rest.
    emptyOutDir: false,
  },
});
