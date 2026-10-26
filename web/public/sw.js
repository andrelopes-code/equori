// Service worker of the installed application (ADR 022, P1). It keeps the shell and its files so
// the application opens without the server; no /api/ answer is ever stored.
const SHELL = "equori-shell-v1";
const FILES = "equori-files-v1";
const STATIC = ["/boot.js", "/boot.css", "/manifest.json", "/icon.svg"];

function assetsOf(html) {
  return [...new Set(html.match(/\/assets\/[^"'\s)]+/g) ?? [])];
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const page = await fetch("/", { cache: "no-store" });
      const html = await page.clone().text();
      await (await caches.open(SHELL)).put("/", page);
      await (await caches.open(FILES)).addAll([...STATIC, ...assetsOf(html)]);
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      for (const name of await caches.keys()) {
        if (name !== SHELL && name !== FILES) await caches.delete(name);
      }
      await self.clients.claim();
    })(),
  );
});

// Network first; a new index.html replaces the stored one and drops the files of the old build.
async function navigate(request) {
  const shell = await caches.open(SHELL);
  try {
    const page = await fetch(request);
    // Only the application's page replaces the shell: a tab may navigate to /healthz or a file.
    const isPage = (page.headers.get("Content-Type") ?? "").startsWith(
      "text/html",
    );
    if (page.ok && isPage && !page.redirected) {
      const html = await page.clone().text();
      const stored = await shell.match("/");
      if (stored === undefined || (await stored.text()) !== html) {
        await caches.delete(FILES);
        await shell.put("/", page.clone());
      }
    }
    return page;
  } catch (error) {
    const stored = await shell.match("/");
    if (stored !== undefined) return stored;
    throw error;
  }
}

// The unhashed files keep their names across builds, so the network answers first.
async function unhashed(request) {
  const files = await caches.open(FILES);
  try {
    const answer = await fetch(request);
    if (answer.ok) await files.put(request, answer.clone());
    return answer;
  } catch (error) {
    const stored = await files.match(request);
    if (stored !== undefined) return stored;
    throw error;
  }
}

async function file(request) {
  const files = await caches.open(FILES);
  const hit = await files.match(request);
  if (hit !== undefined) return hit;
  const answer = await fetch(request);
  if (answer.ok) await files.put(request, answer.clone());
  return answer;
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin || url.pathname.startsWith("/api/"))
    return;
  if (request.mode === "navigate") event.respondWith(navigate(request));
  else if (url.pathname.startsWith("/assets/"))
    event.respondWith(file(request));
  else if (STATIC.includes(url.pathname)) event.respondWith(unhashed(request));
});
