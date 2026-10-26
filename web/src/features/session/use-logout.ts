import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";

import { useDeleteSession } from "@/features/session/api";
import { forgetDeviceUser } from "@/features/session/device-user";

export function useLogout() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const deleteSession = useDeleteSession();
  return {
    logout: () => {
      deleteSession.mutate(undefined, {
        // The shell's own queries refill a cache cleared while it is still mounted, so the
        // cache is cleared once the login route has replaced it.
        onSuccess: () => {
          forgetDeviceUser();
          void navigate({ to: "/login", search: { redirect: undefined } }).then(
            () => {
              queryClient.clear();
            },
          );
        },
      });
    },
    failed: deleteSession.isError,
  };
}
