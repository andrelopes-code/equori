import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";

import { useApi } from "@/api/api-context";
import { instrumentsQuery } from "@/features/setup/api";

// Null until the instrument list has loaded: a caller waits instead of formatting with a guessed scale.
// An unknown code in a loaded list reads as scale 0.
export function useScale(): ((code: string) => number) | null {
  const { data } = useQuery(instrumentsQuery(useApi()));
  return useMemo(() => {
    if (data === undefined) return null;
    const scales = new Map(data.items.map((i) => [i.code, i.scale]));
    return (code) => scales.get(code) ?? 0;
  }, [data]);
}
