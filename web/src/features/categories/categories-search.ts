export interface CategoriesSearch {
  month?: string;
  class?: "income";
  view?: "cash";
  archived?: true;
}

// Expense, accrual and the current month are the defaults and stay out of the address.
export function validateCategoriesSearch(
  raw: Record<string, unknown>,
): CategoriesSearch {
  const month =
    typeof raw.month === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(raw.month)
      ? raw.month
      : undefined;
  return {
    ...(month === undefined ? {} : { month }),
    ...(raw.class === "income" ? { class: "income" as const } : {}),
    ...(raw.view === "cash" ? { view: "cash" as const } : {}),
    ...(raw.archived === true ? { archived: true as const } : {}),
  };
}
