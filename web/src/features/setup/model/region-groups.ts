export interface RegionGroup<T> {
  region: string;
  items: T[];
}

export interface RegionGroups<T> {
  home: RegionGroup<T> | null;
  global: RegionGroup<T> | null;
  others: RegionGroup<T>[];
}

const global = "global";

// Orders the items of a pane by relevance: the book's region, the global group, then every other
// region by code. A group with no item is null. Shortcut: a country of the euro area is not matched
// to the EU group; extend when a spec asks for it.
export function groupByRegion<T>(
  items: readonly T[],
  regionOf: (item: T) => string,
  home: string | undefined,
): RegionGroups<T> {
  const byRegion = new Map<string, T[]>();
  for (const item of items) {
    const region = regionOf(item);
    byRegion.set(region, [...(byRegion.get(region) ?? []), item]);
  }
  const group = (region: string): RegionGroup<T> | null => {
    const found = byRegion.get(region);
    return found === undefined ? null : { region, items: found };
  };
  const homeRegion = home === global ? undefined : home;
  const others = [...byRegion.keys()]
    .filter((region) => region !== global && region !== homeRegion)
    .sort()
    .map((region) => ({ region, items: byRegion.get(region) ?? [] }));

  return {
    home: homeRegion === undefined ? null : group(homeRegion),
    global: group(global),
    others,
  };
}
