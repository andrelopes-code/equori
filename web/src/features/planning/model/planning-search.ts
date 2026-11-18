export type PlanningTab = "agenda" | "schedules" | "subscriptions" | "budgets";

export type BudgetView = "plan" | "track";

export interface PlanningSearch {
  tab?: Exclude<PlanningTab, "agenda">;
  // YYYY-MM; the current month when absent.
  month?: string;
  // The budgets tab's view; absent, a month after the current one opens in plan.
  view?: BudgetView;
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
  const view =
    raw.view === "plan" || raw.view === "track" ? raw.view : undefined;
  return {
    ...(tab === undefined ? {} : { tab }),
    ...(month === undefined ? {} : { month }),
    ...(view === undefined ? {} : { view }),
  };
}

export interface BudgetSearch {
  // YYYY-MM: the month the page reads; the current month when absent.
  month?: string;
}

export function validateBudgetSearch(
  raw: Record<string, unknown>,
): BudgetSearch {
  const { month } = validatePlanningSearch(raw);
  return month === undefined ? {} : { month };
}

export interface BudgetFormSearch {
  // The category the form starts from.
  category?: string;
}

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function validateBudgetFormSearch(
  raw: Record<string, unknown>,
): BudgetFormSearch {
  return typeof raw.category === "string" && uuidPattern.test(raw.category)
    ? { category: raw.category }
    : {};
}

export interface ScheduleFormSearch {
  // The schedule the form continues: its fields fill the form.
  from?: string;
  // A saving the form opens with (planning coherence A255): the account it goes into, its
  // amount in minor units, the goal it is set aside for and its description.
  kind?: "savings";
  counterpart?: string;
  amount?: number;
  goal?: string;
  description?: string;
}

export function validateScheduleFormSearch(
  raw: Record<string, unknown>,
): ScheduleFormSearch {
  const id = (value: unknown) =>
    typeof value === "string" && uuidPattern.test(value) ? value : undefined;
  const from = id(raw.from);
  if (from !== undefined) return { from };

  const counterpart = id(raw.counterpart);
  const goal = id(raw.goal);
  const amount = Number(raw.amount);

  return {
    ...(raw.kind === "savings" ? { kind: "savings" as const } : {}),
    ...(counterpart === undefined ? {} : { counterpart }),
    ...(Number.isSafeInteger(amount) && amount > 0 ? { amount } : {}),
    ...(goal === undefined ? {} : { goal }),
    ...(typeof raw.description === "string" && raw.description !== ""
      ? { description: raw.description.slice(0, 200) }
      : {}),
  };
}
