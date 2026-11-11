import type { MessageKey } from "@/i18n/catalog.en";

const groups = [
  ["transactions", "/transactions"],
  ["cards", "/cards"],
  ["planning", "/planning"],
  ["planning", "/goals"],
  ["reports", "/reports"],
  ["overview", "/overview"],
] as const;

type Group = (typeof groups)[number][0] | "other";

function suggestions(group: Group): readonly MessageKey[] {
  return [
    `assistant.suggestion.${group}.1`,
    `assistant.suggestion.${group}.2`,
    `assistant.suggestion.${group}.3`,
  ];
}

// The welcome's three questions for the screen the reader is on (P20).
export function routeSuggestions(pathname: string): readonly MessageKey[] {
  if (pathname === "/") return suggestions("overview");
  const match = groups.find(
    ([, prefix]) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
  return suggestions(match?.[0] ?? "other");
}
