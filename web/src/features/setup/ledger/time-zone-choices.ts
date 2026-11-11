import type { Choice } from "@/ui/choice-select";

// The default choice, every zone the runtime lists, then the current zone when the runtime lacks it.
export function timeZoneChoices(
  defaultLabel: string,
  current: string | null,
): Choice[] {
  const zones = Intl.supportedValuesOf("timeZone");
  const choices: Choice[] = [
    { value: "", label: defaultLabel },
    ...zones.map((zone) => ({ value: zone, label: zone.replaceAll("_", " ") })),
  ];
  if (current !== null && !zones.includes(current)) {
    choices.push({ value: current, label: current });
  }
  return choices;
}
