import map from "@/navigation/navigation-map.json";

export interface NavigationScreen {
  path: string;
  topics: readonly string[];
  screen: string;
  tasks: readonly string[];
}

export const navigationMap: readonly NavigationScreen[] = map;

function segments(path: string): string[] {
  return (path.length > 1 ? path.replace(/\/$/, "") : path).split("/");
}

/** Finds the screen of a concrete path; a `$name` segment matches one non-empty segment. */
export function matchScreen(path: string): NavigationScreen | undefined {
  const parts = segments(path);
  return navigationMap.find((s) => {
    const pattern = segments(s.path);
    return (
      pattern.length === parts.length &&
      pattern.every((p, i) =>
        p.startsWith("$") ? parts[i] !== "" : p === parts[i],
      )
    );
  });
}
