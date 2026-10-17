import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";

import { useDeleteSession } from "@/features/session/api";

export function useLogout() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const deleteSession = useDeleteSession();
  return () => {
    deleteSession.mutate(undefined, {
      onSuccess: () => {
        queryClient.clear();
        void navigate({ to: "/login", search: { redirect: undefined } });
      },
    });
  };
}
