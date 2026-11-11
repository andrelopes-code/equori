import { numberFormatter } from "@/i18n/format";
import type { Choice } from "@/ui/choice-select";

const presets = [15, 30, 60, 120, 360, 720, 1440];

// The presets, then the current interval when it is not one of them. A multiple of 60 reads in
// hours, any other value in minutes.
export function syncIntervalChoices(
  tag: string,
  current: number | null,
): Choice[] {
  const minutes =
    current === null || presets.includes(current)
      ? presets
      : [...presets, current];
  return minutes.map((value) => ({
    value: String(value),
    label: label(tag, value),
  }));
}

function label(tag: string, minutes: number): string {
  const hours = minutes % 60 === 0;
  return numberFormatter(tag, {
    style: "unit",
    unit: hours ? "hour" : "minute",
    unitDisplay: "long",
  }).format(hours ? minutes / 60 : minutes);
}
