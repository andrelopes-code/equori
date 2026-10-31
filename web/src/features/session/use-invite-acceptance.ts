import { useState } from "react";

import { ProblemError, errorText } from "@/api/problem";
import { useAcceptInvitation } from "@/features/session/api";
import { forgetInviteToken } from "@/features/session/invite-token";
import { reloadHome } from "@/features/session/reload-home";
import { useT } from "@/i18n/i18n-provider";

interface InviteAcceptance {
  accept: (
    extra: { password: string; language: string } | null,
  ) => Promise<void>;
  pending: boolean;
  failure: string | null;
}

// HA27: the stored token is deleted after the 204 and after a 404; the reload then reads the
// session under the book joined (plan Decisions, "Reload").
export function useInviteAcceptance(token: string): InviteAcceptance {
  const t = useT();
  const mutation = useAcceptInvitation();
  const [failure, setFailure] = useState<string | null>(null);

  const accept: InviteAcceptance["accept"] = async (extra) => {
    setFailure(null);
    try {
      await mutation.mutateAsync({ token, ...extra });
    } catch (error) {
      if (error instanceof ProblemError && error.status === 404)
        forgetInviteToken();
      setFailure(errorText(error, t));
      return;
    }
    forgetInviteToken();
    reloadHome();
  };

  return { accept, pending: mutation.isPending, failure };
}
