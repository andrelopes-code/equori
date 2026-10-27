import { isSettingsTopic } from "@/features/setup/settings-topics";
import type { SettingsTopic } from "@/features/setup/settings-topics";

// Every key is absent while it holds its default.
export interface SettingsSearch {
  // The pane on show; a phone lists the panes and a wider screen shows the first one when absent.
  section?: SettingsTopic | undefined;
  // The calendar whose holidays the calendars section lists; none when absent.
  calendar?: string | undefined;
  // The calendar year of those holidays; the year of the app clock when absent.
  year?: number | undefined;
}

// The contract accepts 1900 to 2200 (api/openapi.yaml, parameter Year).
export const minYear = 1900;
export const maxYear = 2200;

export function validateSettingsSearch(
  raw: Record<string, unknown>,
): SettingsSearch {
  const year = Number(raw.year);
  const validYear =
    raw.year !== undefined &&
    raw.year !== "" &&
    Number.isInteger(year) &&
    year >= minYear &&
    year <= maxYear;
  // The keys are always present: the parent route passes the raw address on.
  return {
    section: isSettingsTopic(raw.section) ? raw.section : undefined,
    calendar:
      typeof raw.calendar === "string" && /^[a-z0-9_]{2,40}$/.test(raw.calendar)
        ? raw.calendar
        : undefined,
    year: validYear ? year : undefined,
  };
}
