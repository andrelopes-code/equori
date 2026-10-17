import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react()],
  // tsconfig.json paths are the single definition of the @/ alias.
  resolve: { tsconfigPaths: true },
  server: {
    // make dev serves the API; one origin lets the session cookie through without CORS.
    proxy: { "/api": "http://127.0.0.1:8080" },
  },
  build: {
    // web/dist/.gitkeep must survive the build; make web-build cleans the rest.
    emptyOutDir: false,
  },
});
