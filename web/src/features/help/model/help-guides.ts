// The areas of the app the help index groups its pages by, in the order it shows them.
export const helpAreas = [
  "accounts",
  "cards",
  "transactions",
  "portfolio",
  "planning",
  "installation",
] as const;

export type HelpArea = (typeof helpAreas)[number];

export interface HelpGuide {
  // The block of the index; a page without one has a block of its own there.
  area?: HelpArea;
  // The route the action of the page header opens.
  screen?: string;
  // Written ids of sections of the troubleshooting page.
  symptoms?: readonly string[];
  related?: readonly string[];
}

// Where each page stands in the app and what surrounds it (help spec, HP7).
export const helpGuides: Readonly<Record<string, HelpGuide | undefined>> = {
  "import-statement": {
    area: "accounts",
    screen: "/accounts",
    symptoms: ["transaction-twice", "transaction-missing"],
    related: ["check-balance"],
  },
  "pay-statement": {
    area: "cards",
    screen: "/cards",
    symptoms: ["statement-differs", "transaction-missing"],
    related: ["statement"],
  },
  installments: {
    area: "cards",
    screen: "/cards",
    symptoms: ["statement-differs"],
    related: ["statement"],
  },
  "check-balance": {
    area: "accounts",
    screen: "/accounts",
    symptoms: ["balance-differs"],
  },
  "category-rule": {
    area: "transactions",
    screen: "/transactions",
    related: ["how-money-is-recorded"],
  },
  "record-transaction": {
    area: "transactions",
    screen: "/transactions/new",
    related: ["how-money-is-recorded"],
  },
  "text-capture": {
    area: "transactions",
    screen: "/transactions/capture",
    related: ["record-transaction", "installments"],
  },
  "correct-transaction": {
    area: "transactions",
    screen: "/transactions",
    symptoms: ["transaction-twice"],
    related: ["check-balance"],
  },
  schedule: {
    area: "planning",
    screen: "/planning",
    related: ["budget-plan"],
  },
  "create-budget": {
    area: "planning",
    screen: "/planning",
    related: ["budget-plan"],
  },
  "buy-investment": {
    area: "portfolio",
    screen: "/transactions/new",
    related: ["portfolio"],
  },
  reimbursement: {
    area: "transactions",
    screen: "/transactions",
    related: ["correct-transaction"],
  },
  installation: {
    area: "installation",
    symptoms: ["second-factor", "backup-late", "copy-late", "not-opening"],
  },
  "connect-bank": {
    area: "accounts",
    screen: "/accounts",
    symptoms: ["bank-missing", "connection-stalled", "consent-expiring"],
    related: ["bank-connections"],
  },
  statement: { area: "cards", screen: "/cards", related: ["pay-statement"] },
  portfolio: { area: "portfolio", screen: "/portfolio" },
  "contribution-plan": {
    area: "portfolio",
    screen: "/portfolio/contribution-plan",
    related: ["portfolio", "buy-investment"],
  },
  "budget-plan": { area: "planning", screen: "/planning" },
  "how-money-is-recorded": { area: "transactions" },
  "bank-connections": { area: "accounts", related: ["connect-bank"] },
};
