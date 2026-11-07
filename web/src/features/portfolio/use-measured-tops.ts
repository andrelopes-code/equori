import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";

import { useApi } from "@/api/api-context";
import { accountsQuery } from "@/features/accounts";
import { measuredTops } from "@/features/portfolio/measured-tops";
import { instrumentsQuery } from "@/features/setup";

// The ids of measuredTops for the book, empty until its accounts and instruments load.
export function useMeasuredTops(): ReadonlySet<string> {
  const api = useApi();
  const accounts = useQuery(accountsQuery(api)).data;
  const instruments = useQuery(instrumentsQuery(api)).data;

  return useMemo(() => {
    if (accounts === undefined || instruments === undefined) return new Set();

    const currencies = new Set(
      instruments.items.filter((i) => i.type === "currency").map((i) => i.code),
    );

    return measuredTops(accounts, currencies);
  }, [accounts, instruments]);
}
