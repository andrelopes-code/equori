let source: Promise<string | undefined> | undefined;

// Writes the seed into the fill of the tab icon; a failed fetch leaves the static link.
export async function tintTabIcon(seed: string): Promise<void> {
  const svg = await loadIcon();
  const link = document.head.querySelector<HTMLLinkElement>("link[rel=icon]");
  if (svg === undefined || link === null) return;

  link.setAttribute(
    "href",
    "data:image/svg+xml," +
      encodeURIComponent(svg.replaceAll('fill="white"', `fill="${seed}"`)),
  );
}

// One fetch per page load, failure included.
function loadIcon(): Promise<string | undefined> {
  source ??= fetch("/icon.svg")
    .then((response) => (response.ok ? response.text() : undefined))
    .catch(() => undefined);
  return source;
}
