import { catalogEn } from "@/i18n/catalog.en";
import type { MessageKey } from "@/i18n/catalog.en";
import type { TFunction } from "@/i18n/i18n-provider";

// A preset or a use the server declares without a text in the catalogs reads as its identifier.
export function catalogLabel(
  t: TFunction,
  key: string,
  fallback: string,
): string {
  return key in catalogEn ? t(key as MessageKey) : fallback;
}
