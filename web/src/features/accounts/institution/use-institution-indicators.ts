import { useQuery } from "@tanstack/react-query";

import { useApi } from "@/api/api-context";
import type { components } from "@/api/schema.gen";
import { institutionIndicatorsQuery } from "@/features/accounts/api";

type Institution = components["schemas"]["Institution"];
type InstitutionIndicators = components["schemas"]["InstitutionIndicators"];

// The indicators of an account's institution, or undefined while they load and when the source
// has none for it.
export function useInstitutionIndicators(
  institution: Institution | undefined,
): InstitutionIndicators | undefined {
  const api = useApi();
  const identifier = institution?.identifier;
  const query = useQuery({
    ...institutionIndicatorsQuery(
      api,
      identifier?.scheme ?? "",
      identifier?.identifier ?? "",
    ),
    enabled: identifier !== undefined,
    retry: false,
  });

  return query.data ?? undefined;
}
