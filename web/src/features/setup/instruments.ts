import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";

import { useApi } from "@/api/api-context";
import { instrumentsQuery } from "@/features/setup/api";

// Unknown codes read as scale 0 until the instrument list has loaded.
export function useScale(): (code: string) => number {
  const { data } = useQuery(instrumentsQuery(useApi()));
  const scales = useMemo(
    () => new Map(data?.items.map((i) => [i.code, i.scale])),
    [data],
  );
  return (code) => scales.get(code) ?? 0;
}
