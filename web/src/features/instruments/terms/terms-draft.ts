import type { components } from "@/api/schema.gen";
import { formatRate } from "@/features/instruments/model/rate";
import {
  bpText,
  parsePercentBp,
} from "@/features/instruments/terms/basis-points";
import { shiftDate } from "@/i18n/format";
import type { TFunction } from "@/i18n/i18n-provider";

type Terms = components["schemas"]["FixedIncomeTerms"];
type TermsInput = components["schemas"]["FixedIncomeTermsInput"];
type DayCount = components["schemas"]["TermsDayCount"];

export interface TermsDraft {
  issued: string;
  matures: string;
  index: string;
  percent: string;
  spread: string;
  dayCount: DayCount | null;
  face: number;
}

export type TermsOutcome =
  | { body: TermsInput; errors?: undefined }
  | { body?: undefined; errors: Record<string, string> };

// The dates start at today and a year ahead; the index, the day count and the face value start
// empty, as no value of them is neutral for every region.
export function initialDraft(
  terms: Terms | null,
  today: string,
  locale: string,
): TermsDraft {
  return {
    issued: terms?.issued_on ?? today,
    matures: terms?.matures_on ?? shiftDate(today, 365),
    index: terms?.index_id ?? "",
    percent: formatRate(bpText(terms?.percent_of_index_bp ?? 10000), locale),
    spread: formatRate(bpText(terms?.spread_bp ?? 0), locale),
    dayCount: terms?.day_count ?? null,
    face: terms?.face_value ?? 0,
  };
}

export function termsBody(draft: TermsDraft, t: TFunction): TermsOutcome {
  const errors: Record<string, string> = {};
  const required = t("instruments.required");
  const percentBp = parsePercentBp(draft.percent);
  const spreadBp = parsePercentBp(draft.spread);
  const { dayCount, index } = draft;

  if (percentBp === null || percentBp < 1)
    errors.percent_of_index_bp = t("terms.invalid.percent");
  if (spreadBp === null) errors.spread_bp = t("terms.invalid.percent");
  if (dayCount === null) errors.day_count = required;
  if (draft.face < 1) errors.face_value = required;

  if (
    Object.keys(errors).length > 0 ||
    percentBp === null ||
    spreadBp === null ||
    dayCount === null
  )
    return { errors };

  return {
    body: {
      issued_on: draft.issued,
      matures_on: draft.matures,
      ...(index.trim() === "" ? {} : { index_id: index.trim() }),
      percent_of_index_bp: percentBp,
      spread_bp: spreadBp,
      day_count: dayCount,
      face_value: draft.face,
    },
  };
}
