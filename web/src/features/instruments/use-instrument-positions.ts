import { useQuery } from "@tanstack/react-query";

import { useApi } from "@/api/api-context";
import { positionsQuery } from "@/features/accounts";
import { useToday } from "@/i18n/today";

// The positions of the accounts that hold one instrument at the end of today. listPositions
// answers for every account, so the page filters by the instrument.
export function useInstrumentPositions(code: string) {
  const api = useApi();
  const today = useToday();
  const positions = useQuery(positionsQuery(api, today));

  return {
    positions,
    rows: (positions.data ?? []).filter((p) => p.instrument === code),
  };
}
