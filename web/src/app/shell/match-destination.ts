import { destinations } from "@/app/shell/destinations";
import type { Destination } from "@/app/shell/destinations";

export interface DestinationMatch {
  destination: Destination | undefined;
  // The pathname is the destination's own route, not a record or form below it.
  topLevel: boolean;
}

// The destination whose route equals the pathname or is its longest whole-segment prefix;
// "/" matches only the root path.
export function matchDestination(pathname: string): DestinationMatch {
  let best: Destination | undefined;
  for (const destination of destinations) {
    const { to } = destination;
    const matches =
      pathname === to || (to !== "/" && pathname.startsWith(`${to}/`));
    if (matches && (best === undefined || to.length > best.to.length)) {
      best = destination;
    }
  }
  return { destination: best, topLevel: best?.to === pathname };
}
