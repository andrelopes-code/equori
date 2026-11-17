type NetworkKey =
  | "cardFace.network.visa"
  | "cardFace.network.mastercard"
  | "cardFace.network.amex"
  | "cardFace.network.elo"
  | "cardFace.network.hipercard"
  | "card.network.none";

const keys: Record<string, NetworkKey> = {
  visa: "cardFace.network.visa",
  mastercard: "cardFace.network.mastercard",
  amex: "cardFace.network.amex",
  elo: "cardFace.network.elo",
  hipercard: "cardFace.network.hipercard",
};

// The name of a stored network: its catalog text, the stored key when the catalog has none, and
// the text of "no network" when nothing is stored.
export function networkName(
  network: string | undefined,
  t: (key: NetworkKey) => string,
): string {
  if (network === undefined) {
    return t("card.network.none");
  }

  const key = Object.hasOwn(keys, network) ? keys[network] : undefined;

  return key === undefined ? network : t(key);
}
