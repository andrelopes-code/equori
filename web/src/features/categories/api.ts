import { useMutation, useQueryClient } from "@tanstack/react-query";

import { useApi } from "@/api/api-context";
import { unwrap } from "@/api/problem";
import type { components } from "@/api/schema.gen";
import { accountKeys } from "@/features/accounts";

type AccountInput = components["schemas"]["AccountInput"];

export function useCreateCategory() {
  const api = useApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (body: AccountInput) =>
      unwrap(await api.POST("/accounts", { body })),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: accountKeys.all }),
  });
}
