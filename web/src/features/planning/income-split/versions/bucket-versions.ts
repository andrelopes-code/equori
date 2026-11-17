import type { components } from "@/api/schema.gen";
import type { MessageKey } from "@/i18n/catalog.en";

type Version = components["schemas"]["BudgetBucketVersion"];

export interface FromChoice {
  // YYYY-MM sent to the API.
  from: string;
  kind: "version" | "month";
  // The version in force is the first one: it also covers the months before.
  first: boolean;
}

// The method of month: the last version that starts at or before it, else the first;
// undefined without versions or when that version holds no bucket (A240).
export function versionAt(
  versions: readonly Version[],
  month: string,
): Version | undefined {
  const version = versionRecordAt(versions, month);
  return version === undefined || version.buckets.length === 0
    ? undefined
    : version;
}

// The version record of month even when it holds no bucket; undefined without versions.
export function versionRecordAt(
  versions: readonly Version[],
  month: string,
): Version | undefined {
  const started = versions.filter((v) => v.from <= month);
  return started[started.length - 1] ?? versions[0];
}

// The start of the version after the one of month; undefined when it is the last.
export function nextFrom(
  versions: readonly Version[],
  month: string,
): string | undefined {
  const current = versionRecordAt(versions, month);
  return versions.find((v) => current !== undefined && v.from > current.from)
    ?.from;
}

// The choices of the field Valid from, without repeats: the start of the version in force in
// shown, shown, today. A month choice that starts another version is left out.
export function fromChoices(
  versions: readonly Version[],
  shown: string,
  today: string,
): FromChoice[] {
  const inForce = versionRecordAt(versions, shown);
  if (inForce === undefined) return [];
  const starts = new Set(versions.map((v) => v.from));
  const choices: FromChoice[] = [
    {
      from: inForce.from,
      kind: "version",
      first: inForce.from === versions[0]?.from,
    },
  ];
  for (const from of [shown, today]) {
    const taken = choices.some((c) => c.from === from) || starts.has(from);
    if (!taken) choices.push({ from, kind: "month", first: false });
  }
  return choices;
}

// The last month a version saved at from covers: the month before the next start after from;
// undefined when no version starts after from.
export function lastMonthOf(
  versions: readonly Version[],
  from: string,
): string | undefined {
  const next = versions.find((v) => v.from > from)?.from;
  if (next === undefined) return undefined;
  const [year = 0, month = 1] = next.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 2, 1));
  return `${String(date.getUTCFullYear())}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

// The catalog key that words a choice of the field Valid from.
export function fromLabelKey(choice: FromChoice): MessageKey {
  if (choice.kind === "month") return "buckets.from.month";
  return choice.first ? "buckets.from.start" : "buckets.from.version";
}

// The catalog key of the line that states the period of a choice; closed when a later version
// ends it.
export function periodKey(choice: FromChoice, closed: boolean): MessageKey {
  if (choice.kind === "version" && choice.first)
    return closed ? "buckets.from.startClosed" : "buckets.from.startOpen";
  return closed ? "buckets.from.closed" : "buckets.from.open";
}
