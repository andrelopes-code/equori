// "" is no network. A new card carries a network only when one is chosen; an edit carries it
// only when the choice differs from the stored one.
export function createNetwork(chosen: string): { network?: string } {
  return chosen === "" ? {} : { network: chosen };
}

export function updateNetwork(
  stored: string | undefined,
  chosen: string,
): { network?: string } {
  return chosen === (stored ?? "") ? {} : { network: chosen };
}
