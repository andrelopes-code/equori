const international = ["visa", "mastercard", "amex"] as const;

export function offeredNetworks(region: string | undefined): readonly string[] {
  switch (region) {
    case "BR":
      return [...international, "elo", "hipercard"];
    default:
      return international;
  }
}
