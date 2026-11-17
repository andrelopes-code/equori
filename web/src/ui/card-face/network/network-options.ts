import { offeredNetworks } from "@/ui/card-face/network/offered";

// The networks a region offers, then the stored one when the region does not offer it, so it
// stays selectable.
export function networkOptions(
  region: string | undefined,
  stored: string | undefined,
): readonly string[] {
  const offered = offeredNetworks(region);

  return stored === undefined || stored === "" || offered.includes(stored)
    ? offered
    : [...offered, stored];
}
