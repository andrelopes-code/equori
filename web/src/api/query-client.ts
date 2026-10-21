import { MutationCache, QueryCache, QueryClient } from "@tanstack/react-query";

import { ProblemError } from "@/api/problem";

const maxRetries = 2;

export function newQueryClient(
  onUnauthenticated: () => void,
  retryDelay?: number,
): QueryClient {
  const onError = (error: Error) => {
    if (error instanceof ProblemError && error.status === 401) {
      onUnauthenticated();
    }
  };
  const client: QueryClient = new QueryClient({
    queryCache: new QueryCache({ onError }),
    // A write can change any figure on screen (a balance, a category total, a rule's coverage,
    // a count in a tab); every query goes stale and the ones on screen refetch, so no screen
    // keeps a value the write made wrong.
    mutationCache: new MutationCache({
      onError,
      onSuccess: () => client.invalidateQueries(),
    }),
    defaultOptions: {
      queries: {
        ...(retryDelay === undefined ? {} : { retryDelay }),
        retry: (count, error) =>
          !(error instanceof ProblemError && error.status < 500) &&
          count < maxRetries,
      },
    },
  });
  return client;
}
