const reloadedKey = "equori.stale-build-reload";

// A tab opened before a new build asks for route chunks whose hashed names no longer exist; the
// page reloads once to take the new build. The mark stops a loop when the chunk is really missing.
// shortcut: one reload per tab session; a second new build in the same tab needs a manual reload,
// upgrade by keying the mark on a build id when the server publishes one.
export function reloadOnStaleBuild(env: {
  target: Pick<EventTarget, "addEventListener">;
  storage: Pick<Storage, "getItem" | "setItem">;
  reload: () => void;
}): void {
  env.target.addEventListener("vite:preloadError", (event) => {
    if (env.storage.getItem(reloadedKey) !== null) return;

    env.storage.setItem(reloadedKey, "1");
    event.preventDefault();
    env.reload();
  });
}
