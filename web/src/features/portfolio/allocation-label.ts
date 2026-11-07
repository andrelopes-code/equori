import { catalogLabel } from "@/features/setup";
import type { AllocationBy } from "@/features/portfolio/portfolio-search";
import type { TFunction } from "@/i18n/i18n-provider";

// The key of a group is a type, a currency code or an institution id; the empty key is the
// accounts without an institution. A type the catalog does not name reads as its code, and an
// institution not yet loaded reads as its id.
export function allocationLabel(
  t: TFunction,
  by: AllocationBy,
  key: string,
  institutions: ReadonlyMap<string, string>,
): string {
  if (by === "type") return catalogLabel(t, `instruments.type.${key}`, key);
  if (by === "institution" && key === "")
    return t("portfolio.allocation.noInstitution");
  if (by === "institution") return institutions.get(key) ?? key;

  return key;
}
