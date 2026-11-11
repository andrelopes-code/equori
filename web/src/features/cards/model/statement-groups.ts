import type { components } from "@/api/schema.gen";

export type Statement = components["schemas"]["StatementSummary"];
export type StatementLine = components["schemas"]["StatementPosting"];

export interface StatementGroups {
  current?: Statement;
  upcoming: Statement[];
  past: Statement[];
}

export function groupStatements(ascending: Statement[]): StatementGroups {
  const index = ascending.findIndex((s) => s.status === "open");
  const current = ascending[index];
  if (current === undefined) {
    return { upcoming: [], past: [...ascending].reverse() };
  }
  return {
    current,
    upcoming: ascending.slice(index + 1),
    past: ascending.slice(0, index).reverse(),
  };
}

export function neighbours(
  ascending: Statement[],
  id: string,
): { previous?: string; next?: string } {
  const index = ascending.findIndex((s) => s.id === id);
  if (index < 0) return {};
  const previous = ascending[index - 1]?.id;
  const next = ascending[index + 1]?.id;
  return {
    ...(previous === undefined ? {} : { previous }),
    ...(next === undefined ? {} : { next }),
  };
}
