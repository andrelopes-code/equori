import { catalogLabel } from "@/features/setup";
import type { components } from "@/api/schema.gen";
import type { TFunction } from "@/i18n/i18n-provider";

type Holiday = components["schemas"]["Holiday"];

// A rule holiday reads in the language of the user through its code; one the catalogs do not name,
// and an instance holiday, read as the server sent them.
export function holidayName(t: TFunction, holiday: Holiday): string {
  return holiday.code === undefined
    ? holiday.name
    : catalogLabel(t, `calendar.holiday.${holiday.code}`, holiday.name);
}
