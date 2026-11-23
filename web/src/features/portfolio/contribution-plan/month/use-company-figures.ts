import { useQueries } from "@tanstack/react-query";

import { useApi } from "@/api/api-context";
import type { components } from "@/api/schema.gen";
import { companyFiguresQuery } from "@/features/instruments";

type Figures = components["schemas"]["CompanyFigures"];

// The figures of the company of each code that has one.
export function useCompanyFigures(codes: string[]): Map<string, Figures> {
  const api = useApi();
  const results = useQueries({
    queries: codes.map((code) => companyFiguresQuery(api, code)),
  });

  const figures = new Map<string, Figures>();

  results.forEach((result, i) => {
    const code = codes[i];
    const first = result.data?.[0];

    if (code !== undefined && first !== undefined) figures.set(code, first);
  });

  return figures;
}
