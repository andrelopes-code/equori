import { createContext, useContext } from "react";
import type { ReactNode } from "react";

import { todayISO } from "@/i18n/format";

const TodayContext = createContext<string | undefined>(undefined);

export function TodayProvider({
  today,
  children,
}: {
  today?: string;
  children: ReactNode;
}) {
  return <TodayContext value={today}>{children}</TodayContext>;
}

export function useToday(): string {
  return useContext(TodayContext) ?? todayISO();
}
