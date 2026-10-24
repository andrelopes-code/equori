import { useQuery } from "@tanstack/react-query";

import { useApi } from "@/api/api-context";
import { settingsQuery, useScale } from "@/features/setup";

// The base currency and the scale of every instrument; undefined fields while they load.
export function useBase() {
  const settings = useQuery(settingsQuery(useApi()));
  const scale = useScale();
  return {
    base: settings.data?.base_currency,
    scale,
    error: settings.error,
    retry: () => void settings.refetch(),
  };
}
