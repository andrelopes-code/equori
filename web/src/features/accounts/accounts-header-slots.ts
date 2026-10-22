import { createContext } from "react";

// The places in the destination's shared header where the page below writes its subheading and
// its actions, and the refresh the page asked for; the header stays mounted while the tabs switch
// pages, so its indicator slides.
export const AccountsHeaderSlots = createContext<{
  subheading: HTMLElement | null;
  actions: HTMLElement | null;
  setRefreshing: (refreshing: boolean) => void;
}>({ subheading: null, actions: null, setRefreshing: () => undefined });
