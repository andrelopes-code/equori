import { createContext, useContext } from "react";

interface SessionExpiry {
  trigger: () => void;
  install: (handler: () => void) => () => void;
}

// The router is built outside AppProviders, so AppRouterProvider installs the 401 handler here.
export const SessionExpiryContext = createContext<SessionExpiry | null>(null);

export function useSessionExpiry(): SessionExpiry {
  const expiry = useContext(SessionExpiryContext);
  if (expiry === null) {
    throw new Error("useSessionExpiry requires AppProviders");
  }
  return expiry;
}

export function newSessionExpiry(): SessionExpiry {
  let handler: (() => void) | null = null;
  return {
    trigger: () => {
      handler?.();
    },
    install: (next) => {
      handler = next;
      return () => {
        handler = null;
      };
    },
  };
}
