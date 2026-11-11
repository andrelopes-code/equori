import type { components } from "@/api/schema.gen";
import { catalogLabel } from "@/features/setup";
import type { TFunction } from "@/i18n/i18n-provider";

export const typeLabel = (t: TFunction, type: string) =>
  catalogLabel(t, `instruments.type.${type}`, type);

export const subtypeLabel = (t: TFunction, subtype: string) =>
  catalogLabel(t, `instruments.subtype.${subtype}`, subtype);

export const sourceLabel = (t: TFunction, source: string) =>
  catalogLabel(t, `instruments.source.${source}`, source);

export const dayCountLabel = (t: TFunction, dayCount: string) =>
  catalogLabel(t, `instruments.dayCount.${dayCount}`, dayCount);

// The contract's enumeration of TermsDayCount.
export const dayCounts = [
  "bus252",
  "act365",
] as const satisfies readonly components["schemas"]["TermsDayCount"][];
