// Returns the longest of `paths` that equals `pathname` or is a whole-segment prefix of it.
// "/" matches only the root path.
export function bestMatch(
  pathname: string,
  paths: readonly string[],
): string | undefined {
  let best: string | undefined;
  for (const path of paths) {
    const matches =
      pathname === path || (path !== "/" && pathname.startsWith(`${path}/`));
    if (matches && (best === undefined || path.length > best.length)) {
      best = path;
    }
  }
  return best;
}
