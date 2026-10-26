// @vitest-environment node
import { readFileSync } from "node:fs";
import { beforeEach, describe, expect, it } from "vitest";

const source = readFileSync(
  new URL("../../public/sw.js", import.meta.url),
  "utf8",
);
const origin = "https://equori.test";

type Listener = (event: Record<string, unknown>) => void;

let pages: Record<string, string>;
let online: boolean;
function server(req: Request): Promise<Response> {
  if (!online) return Promise.reject(new TypeError("Failed to fetch"));
  const path = new URL(req.url).pathname;
  const body = pages[path] ?? pages["/"];
  return Promise.resolve(new Response(body, { status: 200 }));
}

// In-memory CacheStorage with string keys (absolute URLs).
function fakeCaches() {
  const stores = new Map<string, Map<string, Response>>();
  const key = (r: Request | string) =>
    new URL(typeof r === "string" ? r : r.url, origin).href;
  const open = (name: string) => {
    const store = stores.get(name) ?? new Map<string, Response>();
    stores.set(name, store);
    return {
      match: (r: Request | string) =>
        Promise.resolve(store.get(key(r))?.clone()),
      put: (r: Request | string, res: Response) => {
        store.set(key(r), res);
        return Promise.resolve();
      },
      addAll: async (urls: string[]) => {
        for (const u of urls)
          store.set(key(u), await server(new Request(new URL(u, origin))));
      },
    };
  };
  return {
    stores,
    api: {
      open: (name: string) => Promise.resolve(open(name)),
      keys: () => Promise.resolve([...stores.keys()]),
      delete: (name: string) => Promise.resolve(stores.delete(name)),
    },
  };
}

function load() {
  const listeners: Record<string, Listener> = {};
  const caches = fakeCaches();
  const self = {
    location: new URL(origin),
    addEventListener: (type: string, fn: Listener) => {
      listeners[type] = fn;
    },
    skipWaiting: () => Promise.resolve(),
    clients: { claim: () => Promise.resolve() },
  };
  // The service worker is a classic script; the test runs it in a scope of fakes.
  // eslint-disable-next-line @typescript-eslint/no-implied-eval
  const script = new Function("self", "caches", "fetch", source) as (
    self: unknown,
    caches: unknown,
    fetch: (r: Request | string) => Promise<Response>,
  ) => void;
  script(self, caches.api, (r) =>
    server(typeof r === "string" ? new Request(new URL(r, origin)) : r),
  );

  const run = async (type: string, extra: Record<string, unknown> = {}) => {
    let waited: Promise<unknown> = Promise.resolve();
    let answered: Promise<Response> | undefined;
    listeners[type]?.({
      ...extra,
      waitUntil: (p: Promise<unknown>) => {
        waited = p;
      },
      respondWith: (p: Promise<Response>) => {
        answered = p;
      },
    });
    await waited;
    return answered;
  };
  const request = (path: string, mode: RequestMode = "cors") =>
    ({ url: origin + path, method: "GET", mode }) as unknown as Request;
  return { caches, run, request };
}

const index = (build: string) =>
  `<script src="/boot.js"></script><script type="module" src="/assets/index-${build}.js"></script>`;

describe("sw.js", () => {
  beforeEach(() => {
    online = true;
    pages = {
      "/": index("a1"),
      "/assets/index-a1.js": "a1",
      "/assets/index-b2.js": "b2",
      "/boot.js": "boot",
      "/boot.css": "",
      "/manifest.json": "{}",
      "/icon.svg": "<svg/>",
    };
  });

  it("stores the shell and the files it names on install", async () => {
    const sw = load();
    await sw.run("install");
    expect([
      ...(sw.caches.stores.get("equori-files-v1")?.keys() ?? []),
    ]).toContain(`${origin}/assets/index-a1.js`);
    expect(sw.caches.stores.get("equori-shell-v1")?.has(`${origin}/`)).toBe(
      true,
    );
  });

  it("answers a navigation from the stored shell without the server", async () => {
    const sw = load();
    await sw.run("install");
    online = false;
    const answer = await sw.run("fetch", {
      request: sw.request("/transactions", "navigate"),
    });
    expect(await answer?.text()).toBe(index("a1"));
  });

  it("replaces the shell and clears assets when index.html changes", async () => {
    const sw = load();
    await sw.run("install");
    pages["/"] = index("b2");
    await sw.run("fetch", { request: sw.request("/", "navigate") });
    expect(sw.caches.stores.has("equori-files-v1")).toBe(false);
    online = false;
    const answer = await sw.run("fetch", {
      request: sw.request("/", "navigate"),
    });
    expect(await answer?.text()).toBe(index("b2"));
  });

  it("never answers an /api/ request", async () => {
    const sw = load();
    await sw.run("install");
    expect(
      await sw.run("fetch", { request: sw.request("/api/v1/me") }),
    ).toBeUndefined();
  });
});
