import { catalogEn } from "@/i18n/catalog.en";
import type { MessageKey } from "@/i18n/catalog.en";
import type { TFunction } from "@/i18n/i18n-provider";

// The words a feed shows, by its id. A feed the catalogs do not name reads as its id, with no source.
function label(t: TFunction, key: string, fallback: string): string {
  return key in catalogEn ? t(key as MessageKey) : fallback;
}

// "PTAX exchange rates": what the feed quotes.
export function feedName(t: TFunction, id: string): string {
  return label(t, `marketData.feedName.${id}`, id);
}

// "Banco Central do Brasil": who publishes it. Empty for a feed the catalogs do not name.
export function feedSource(t: TFunction, id: string): string {
  return label(t, `marketData.feedSource.${id}`, "");
}

// The name and the source in one phrase, for a screen reader: the switch is named by it.
export function feedFullName(t: TFunction, id: string): string {
  return label(t, `marketData.feed.${id}`, id);
}
