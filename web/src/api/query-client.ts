import { MutationCache, QueryCache, QueryClient } from "@tanstack/react-query";

import { ProblemError } from "@/api/problem";

const maxRetries = 2;

export function newQueryClient(onUnauthenticated: () => void): QueryClient {
  const onError = (error: Error) => {
    if (error instanceof ProblemError && error.status === 401) {
      onUnauthenticated();
    }
  };
  return new QueryClient({
    queryCache: new QueryCache({ onError }),
    mutationCache: new MutationCache({ onError }),
    defaultOptions: {
      queries: {
        retry: (count, error) =>
          !(error instanceof ProblemError && error.status < 500) &&
          count < maxRetries,
      },
    },
  });
}
