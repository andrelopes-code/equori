import { useMatches } from "@tanstack/react-router";
import type { ReactNode } from "react";

import { WideScreenNotice } from "@/app/shell/wide-screen-notice";
import { compactQuery, useMediaQuery } from "@/ui/use-media-query";

interface PhoneGateProps {
  children: ReactNode;
}

// ADR 027, S2: below 600 px only a route with staticData.phone renders its page.
export function PhoneGate({ children }: PhoneGateProps) {
  const compact = useMediaQuery(compactQuery);
  const phone = useMatches({
    select: (matches) => matches.at(-1)?.staticData.phone === true,
  });

  if (compact && !phone) return <WideScreenNotice />;

  return children;
}
