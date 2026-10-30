import { catalogEn } from "@/i18n/catalog.en";
import type { MessageKey } from "@/i18n/catalog.en";

// A key the server composes (a tool, a field, an action) when the catalogue holds it.
export function catalogKey(key: string): MessageKey | undefined {
  return key in catalogEn ? (key as MessageKey) : undefined;
}
