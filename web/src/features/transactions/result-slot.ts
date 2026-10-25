import { createContext } from "react";

// The element of the page footer that holds the live result of an entry: the result shares the
// footer's one material instead of laying a second blur over it.
export const ResultSlotContext = createContext<HTMLElement | null>(null);
