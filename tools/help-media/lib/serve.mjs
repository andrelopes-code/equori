// Serves the production build of the application (web/dist) to the capture: the bundle that
// ships, with no development server whose reloads could reach a figure. Every /api request is
// answered by the tape, so no backend runs.
import { existsSync, readFileSync } from "node:fs";
import { createServer } from "node:http";
import { extname, join, normalize } from "node:path";

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".webm": "video/webm",
  ".woff2": "font/woff2",
  ".ico": "image/x-icon",
};

export async function serveBuild(dist) {
  if (!existsSync(join(dist, "index.html"))) {
    throw new Error(`no build at ${dist}: run "make web-build" first`);
  }

  const server = createServer((request, response) => {
    const path = normalize(decodeURIComponent(new URL(request.url, "http://x").pathname));
    const file = join(dist, path);
    const found = file.startsWith(dist) && existsSync(file) && extname(file) !== "";
    // A route of the application is answered by its shell.
    const target = found ? file : join(dist, "index.html");

    response.writeHead(200, { "content-type": TYPES[extname(target)] ?? "application/octet-stream" });
    response.end(readFileSync(target));
  });

  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));

  return {
    base: `http://127.0.0.1:${server.address().port}`,
    close: () => new Promise((resolve) => server.close(resolve)),
  };
}
