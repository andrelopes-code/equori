import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";

import { useDeleteSession } from "@/features/session/api";
import { clearDraft } from "@/features/transactions";

export function useLogout() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const deleteSession = useDeleteSession();
  return {
    logout: () => {
      deleteSession.mutate(undefined, {
        onSuccess: () => {
          queryClient.clear();
          clearDraft();
          void navigate({ to: "/login", search: { redirect: undefined } });
        },
      });
    },
    failed: deleteSession.isError,
  };
}
