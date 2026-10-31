import { useRouter, useRouterState } from "@tanstack/react-router";
import { useEffect, useState } from "react";

import {
  readInviteToken,
  writeInviteToken,
} from "@/features/session/invite-token";

// The token arrives in the fragment of the link (HA25); it is stored for the login step of an
// existing member (HA27) and taken out of the address bar and the history.
export function useInviteToken(): string {
  const router = useRouter();
  const hash = useRouterState({ select: (s) => s.location.hash });
  const [token] = useState(() => {
    const fromHash = fragmentToken(hash);
    if (fromHash !== "") writeInviteToken(fromHash);
    return fromHash === "" ? (readInviteToken() ?? "") : fromHash;
  });

  useEffect(() => {
    if (hash !== "")
      void router.navigate({ to: "/invite", hash: "", replace: true });
  }, [hash, router]);

  return token;
}

function fragmentToken(hash: string): string {
  return new URLSearchParams(hash.replace(/^#/, "")).get("token") ?? "";
}
