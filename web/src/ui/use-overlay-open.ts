import { createContext, useContext } from "react";

export const OverlayOpenContext = createContext(true);

// Whether the dialog or drawer under a Presence stands open; true outside one.
export function useOverlayOpen(): boolean {
  return useContext(OverlayOpenContext);
}
