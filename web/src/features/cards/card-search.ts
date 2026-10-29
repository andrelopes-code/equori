export type CardTab = "statements" | "plans" | "cards" | "settings";

// The tabs a card's page offers below 600 px (ADR 027, S5).
export const phoneCardTabs: readonly CardTab[] = ["statements", "plans"];

export interface CardSearch {
  tab?: Exclude<CardTab, "statements">;
  // The first reference month the statements tab reads.
  from?: string;
  // The billing cycle form stands open in the settings tab (FM-12).
  rule?: true;
}

const tabs = ["plans", "cards", "settings"] as const;

export function validateCardSearch(raw: Record<string, unknown>): CardSearch {
  const tab = tabs.find((t) => t === raw.tab);
  return {
    ...(tab === undefined ? {} : { tab }),
    ...(typeof raw.from === "string" &&
    /^\d{4}-(0[1-9]|1[0-2])$/u.test(raw.from)
      ? { from: raw.from }
      : {}),
    ...(raw.rule === true ? { rule: true as const } : {}),
  };
}
