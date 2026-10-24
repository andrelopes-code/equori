export type PlanningTab = "agenda" | "schedules" | "subscriptions" | "budgets";

export interface PlanningSearch {
  tab?: Exclude<PlanningTab, "agenda">;
  // YYYY-MM; the current month when absent.
  month?: string;
}

const tabs: readonly PlanningTab[] = [
  "agenda",
  "schedules",
  "subscriptions",
  "budgets",
];

export function validatePlanningSearch(
  raw: Record<string, unknown>,
): PlanningSearch {
  const tab = tabs.find((t) => t !== "agenda" && t === raw.tab) as
    Exclude<PlanningTab, "agenda"> | undefined;
  const month =
    typeof raw.month === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(raw.month)
      ? raw.month
      : undefined;
  return {
    ...(tab === undefined ? {} : { tab }),
    ...(month === undefined ? {} : { month }),
  };
}
