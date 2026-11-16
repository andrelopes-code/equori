import { useEffect, useState } from "react";

// One SVG per country, from the flag-icons package (ADR 036). Each file is its own chunk, so a page
// loads only the flags it shows.
const loaders = import.meta.glob<string>(
  "../../../node_modules/flag-icons/flags/4x3/*.svg",
  { query: "?url", import: "default" },
);

const cache = new Map<string, string | null>();

function loaderOf(region: string) {
  return loaders[
    `../../../node_modules/flag-icons/flags/4x3/${region.toLowerCase()}.svg`
  ];
}

// The URL of the flag of a region, or null while it loads and when the region has no file.
export function useFlagUrl(region: string): string | null {
  const [, rerender] = useState(0);

  useEffect(() => {
    const load = loaderOf(region);
    if (cache.has(region) || load === undefined) return;
    let live = true;
    void load()
      .then((found) => {
        cache.set(region, found);
        if (live) rerender((n) => n + 1);
      })
      .catch(() => {
        cache.set(region, null);
      });

    return () => {
      live = false;
    };
  }, [region]);

  return cache.get(region) ?? null;
}
