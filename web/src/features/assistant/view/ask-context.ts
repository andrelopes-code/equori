import { createContext, useContext } from "react";

// Sends a follow-up question as the next message; absent where no conversation runs (a preview).
export const AskContext = createContext<((text: string) => void) | undefined>(
  undefined,
);

export function useAsk(): ((text: string) => void) | undefined {
  return useContext(AskContext);
}
