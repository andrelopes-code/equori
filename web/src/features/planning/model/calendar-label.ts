import { catalogLabel } from "@/features/setup";
import type { TFunction } from "@/i18n/i18n-provider";

// A calendar the catalogs do not name reads as its id.
export function calendarLabel(t: TFunction, id: string): string {
  return catalogLabel(t, `calendar.${id}`, id);
}
