import { expect, it, vi } from "vitest";

import { reloadOnStaleBuild } from "@/app/stale-build";

it("reloads once when a route chunk of an older build is missing", () => {
  const target = new EventTarget();
  const marks = new Map<string, string>();
  const reload = vi.fn();
  reloadOnStaleBuild({
    target,
    storage: {
      getItem: (key) => marks.get(key) ?? null,
      setItem: (key, value) => void marks.set(key, value),
    },
    reload,
  });

  target.dispatchEvent(new Event("vite:preloadError", { cancelable: true }));
  target.dispatchEvent(new Event("vite:preloadError", { cancelable: true }));

  expect(reload).toHaveBeenCalledTimes(1);
});
