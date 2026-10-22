import type { Method } from "@/features/admin/api";

// What a body template reads: the session's dates and the first account of a kind or class.
export interface Refs {
  today: string;
  month: string;
  currency: string;
  account: (kindOrClass: string) => string;
  aggregator: Aggregator | undefined;
}

// The first aggregator the server lists, with an empty value for each credential field.
export interface Aggregator {
  id: string;
  name: string;
  credentials: Record<string, string>;
}

export interface Operation {
  id: string;
  method: Method;
  path: string;
  query?: readonly string[];
  body?: (refs: Refs) => unknown;
}

const money = (r: Refs, amount: number) => ({ amount, currency: r.currency });

const page = ["limit", "cursor"] as const;

// Optional fields stand as "", which the form drops when left empty.
const recurrence = (r: Refs) => ({
  frequency: "monthly",
  interval: 1,
  day_of_month: 10,
  weekday: "",
  ordinal: "",
  business_day_ordinal: "",
  adjustment: "following",
  start: r.today,
  until: "",
  count: "",
});

const optionalPosting = {
  status: "",
  settled_on: "",
  statement: "",
  card_role: "",
  memo: "",
};

const postings = (r: Refs) => [
  {
    account_id: r.account("expense"),
    amount: money(r, 5000),
    ...optionalPosting,
  },
  {
    account_id: r.account("checking"),
    amount: money(r, -5000),
    ...optionalPosting,
    status: "cleared",
  },
];

export type GroupKey =
  | "accounts"
  | "transactions"
  | "cards"
  | "schedules"
  | "planning"
  | "registry"
  | "reconciliation"
  | "categorization"
  | "ingestion"
  | "investments";

// One entry per operation of api/openapi.yaml, except the session's own.
export const operations: Record<GroupKey, readonly Operation[]> = {
  accounts: [
    { id: "listAccounts", method: "GET", path: "/accounts", query: page },
    {
      id: "createAccount",
      method: "POST",
      path: "/accounts",
      body: (r) => ({
        name: "New account",
        class: "asset",
        kind: "checking",
        currency: r.currency,
        parent_id: "",
        institution_id: "",
        opened_on: r.today,
        yield_mode: "none",
      }),
    },
    { id: "getAccount", method: "GET", path: "/accounts/{id}" },
    {
      id: "updateAccount",
      method: "PATCH",
      path: "/accounts/{id}",
      body: () => ({
        name: "Renamed",
        parent_id: "",
        institution_id: "",
        yield_mode: "",
      }),
    },
    {
      id: "closeAccount",
      method: "POST",
      path: "/accounts/{id}/close",
      body: (r) => ({ closed_on: r.today }),
    },
    { id: "reopenAccount", method: "POST", path: "/accounts/{id}/reopen" },
    {
      id: "setAccountParent",
      method: "PUT",
      path: "/accounts/{id}/parent",
      body: () => ({ parent_id: null }),
    },
    {
      id: "setAccountAppearance",
      method: "PUT",
      path: "/accounts/{id}/appearance",
      body: () => ({ color: 1, icon: "tag" }),
    },
    {
      id: "mergeAccount",
      method: "POST",
      path: "/accounts/{id}/merge",
      body: () => ({ into: "" }),
    },
    {
      id: "getAccountBalance",
      method: "GET",
      path: "/accounts/{id}/balance",
      query: ["date", "basis", "value_in"],
    },
    {
      id: "listBalances",
      method: "GET",
      path: "/balances",
      query: ["date", "basis"],
    },
    {
      id: "getBalanceSeries",
      method: "GET",
      path: "/reports/balances",
      query: ["account_id", "from", "to", "basis"],
    },
    {
      id: "getAccountFlows",
      method: "GET",
      path: "/reports/flows",
      query: ["account_id", "from", "to"],
    },
    {
      id: "getProjection",
      method: "GET",
      path: "/accounts/{id}/projection",
      query: ["to"],
    },
  ],
  transactions: [
    {
      id: "listTransactions",
      method: "GET",
      path: "/transactions",
      query: [
        ...page,
        "account_id",
        "payee_id",
        "tag",
        "from",
        "to",
        "uncategorized",
        "q",
      ],
    },
    {
      id: "createTransaction",
      method: "POST",
      path: "/transactions",
      body: (r) => ({
        date: r.today,
        description: "Groceries",
        payee_id: "",
        tags: [],
        postings: postings(r),
      }),
    },
    {
      id: "createTransactionBatch",
      method: "POST",
      path: "/transaction-batches",
      body: (r) => ({
        entries: [
          {
            transaction: {
              date: r.today,
              description: "Groceries",
              postings: postings(r),
            },
          },
        ],
      }),
    },
    {
      id: "previewCapture",
      method: "POST",
      path: "/capture/preview",
      body: () => ({ text: "ontem mercado 230\nuber 32,50" }),
    },
    {
      id: "suggestCaptureCategories",
      method: "POST",
      path: "/capture/suggestions",
      body: () => ({
        items: [{ description: "Padaria São João", kind: "expense" }],
      }),
    },
    { id: "getTransaction", method: "GET", path: "/transactions/{id}" },
    {
      id: "correctTransaction",
      method: "PUT",
      path: "/transactions/{id}",
      body: (r) => ({
        date: r.today,
        description: "Groceries",
        payee_id: "",
        tags: [],
        postings: postings(r),
        expected_version: 1,
        reason: "Wrong amount",
      }),
    },
    {
      id: "voidTransaction",
      method: "POST",
      path: "/transactions/{id}/void",
      body: () => ({ reason: "Duplicate" }),
    },
    {
      id: "categorizeTransaction",
      method: "POST",
      path: "/transactions/{id}/categorize",
      body: (r) => ({
        expected_version: 1,
        parts: [{ account_id: r.account("expense"), amount: money(r, 5000) }],
        payee_id: "",
      }),
    },
    {
      id: "transferTransaction",
      method: "POST",
      path: "/transactions/{id}/transfer",
      body: (r) => ({
        expected_version: 1,
        account_id: r.account("savings"),
        pair_with: "",
      }),
    },
    {
      id: "reimburseTransaction",
      method: "POST",
      path: "/transactions/{id}/reimbursement",
      body: () => ({ expected_version: 1, allocations: [] }),
    },
    {
      id: "listReimbursementCandidates",
      method: "GET",
      path: "/transactions/{id}/reimbursement-candidates",
    },
    {
      id: "listReimbursementSources",
      method: "GET",
      path: "/transactions/{id}/reimbursement-sources",
    },
    {
      id: "listTransactionVersions",
      method: "GET",
      path: "/transactions/{id}/versions",
    },
    {
      id: "refundTransaction",
      method: "POST",
      path: "/transactions/{id}/refunds",
      body: (r) => ({ date: r.today, amount: money(r, 5000), statement: "" }),
    },
    { id: "listDisputes", method: "GET", path: "/transactions/{id}/disputes" },
    {
      id: "openDispute",
      method: "POST",
      path: "/transactions/{id}/disputes",
      body: (r) => ({ opened_on: r.today }),
    },
    {
      id: "resolveDispute",
      method: "POST",
      path: "/disputes/{id}/resolve",
      body: (r) => ({
        resolved_on: r.today,
        outcome: "won",
        statement: r.month,
      }),
    },
    {
      id: "recordForeignPurchase",
      method: "POST",
      path: "/foreign-purchases",
      body: (r) => ({
        account_id: r.account("credit_card"),
        category_id: r.account("expense"),
        date: r.today,
        description: "Online store",
        original: { amount: 1999, currency: "USD" },
        rate: "5.4321",
        foreign_charge_rate_bp: 350,
        statement: r.month,
      }),
    },
    {
      id: "exchangeCurrency",
      method: "POST",
      path: "/exchanges",
      body: (r) => ({
        from_account_id: r.account("checking"),
        to_account_id: r.account("wallet"),
        date: r.today,
        from_amount: money(r, 54321),
        to_amount: { amount: 10000, currency: "USD" },
      }),
    },
    {
      id: "listAttachments",
      method: "GET",
      path: "/transactions/{id}/attachments",
      query: page,
    },
    { id: "deleteAttachment", method: "DELETE", path: "/attachments/{id}" },
  ],
  cards: [
    {
      id: "listBillingCycleRules",
      method: "GET",
      path: "/accounts/{id}/billing-cycle-rules",
    },
    {
      id: "createBillingCycleRule",
      method: "POST",
      path: "/accounts/{id}/billing-cycle-rules",
      body: (r) => ({
        effective_from: r.month,
        closing_day: 3,
        due_day: 10,
        closing_day_assignment: "next",
        due_date_adjustment: "following",
        calendar: "",
      }),
    },
    {
      id: "listCreditLimits",
      method: "GET",
      path: "/accounts/{id}/credit-limits",
    },
    {
      id: "createCreditLimit",
      method: "POST",
      path: "/accounts/{id}/credit-limits",
      body: (r) => ({ effective_from: r.today, amount: money(r, 1000000) }),
    },
    { id: "listCards", method: "GET", path: "/accounts/{id}/cards" },
    {
      id: "createCard",
      method: "POST",
      path: "/accounts/{id}/cards",
      body: () => ({ holder: "Holder", last_four: "1234", virtual: false }),
    },
    {
      id: "updateCard",
      method: "PATCH",
      path: "/cards/{id}",
      body: () => ({ active: false }),
    },
    {
      id: "listStatements",
      method: "GET",
      path: "/accounts/{id}/statements",
      query: ["from", "to", ...page],
    },
    { id: "getStatement", method: "GET", path: "/statements/{id}" },
    {
      id: "setStatementFacts",
      method: "PUT",
      path: "/statements/{id}/facts",
      body: (r) => ({
        closing_date: "",
        due_date: r.today,
        total: money(r, 150000),
        minimum: { amount: "", currency: r.currency },
      }),
    },
    {
      id: "removeStatementFacts",
      method: "DELETE",
      path: "/statements/{id}/facts",
    },
    {
      id: "createInstallmentPurchase",
      method: "POST",
      path: "/installment-purchases",
      body: (r) => ({
        card_account_id: r.account("credit_card"),
        date: r.today,
        description: "Television",
        payee_id: "",
        tags: [],
        splits: [
          { account_id: r.account("expense"), amount: money(r, 300000) },
        ],
        installment_count: 10,
        interest: { amount: "", currency: r.currency },
        first_statement: "",
      }),
    },
    {
      id: "getCommitment",
      method: "GET",
      path: "/accounts/{id}/commitments",
      query: ["month"],
    },
    {
      id: "getStatementPlacement",
      method: "GET",
      path: "/accounts/{id}/statement-placement",
      query: ["date"],
    },
    {
      id: "payStatement",
      method: "POST",
      path: "/statements/{id}/payments",
      body: (r) => ({
        date: r.today,
        from_account_id: r.account("checking"),
        amount: money(r, 10000),
      }),
    },
    {
      id: "financeStatement",
      method: "POST",
      path: "/statements/{id}/financing",
      body: (r) => ({
        date: r.today,
        installment_count: 6,
        installment_amount: money(r, 20000),
      }),
    },
    {
      id: "reconcileStatement",
      method: "POST",
      path: "/statements/{id}/reconcile",
      body: (r) => ({ amount_due: money(r, 10000) }),
    },
    {
      id: "getInstallmentPlan",
      method: "GET",
      path: "/installment-plans/{id}",
    },
    {
      id: "cancelInstallmentPlan",
      method: "POST",
      path: "/installment-plans/{id}/cancellation",
      body: (r) => ({ date: r.today, credit_statement: r.month }),
    },
    {
      id: "anticipateInstallments",
      method: "POST",
      path: "/installment-plans/{id}/anticipation",
      body: (r) => ({
        date: r.today,
        from_installment: 9,
        to_installment: 10,
        target_statement: r.month,
        amount: money(r, 58000),
      }),
    },
  ],
  schedules: [
    { id: "listSchedules", method: "GET", path: "/schedules", query: page },
    {
      id: "createSchedule",
      method: "POST",
      path: "/schedules",
      body: (r) => ({
        kind: "bill",
        account_id: r.account("checking"),
        counterpart_id: r.account("expense"),
        payee_id: "",
        description: "Rent",
        amount: money(r, -250000),
        recurrence: recurrence(r),
        match_tolerance_bp: "",
        grace_days: "",
      }),
    },
    { id: "getSchedule", method: "GET", path: "/schedules/{id}" },
    {
      id: "listOccurrences",
      method: "GET",
      path: "/occurrences",
      query: ["from", "to", "schedule_id", "state"],
    },
    {
      id: "realizeOccurrence",
      method: "POST",
      path: "/occurrences/{id}/realize",
      body: () => ({ transaction_id: "" }),
    },
    {
      id: "unrealizeOccurrence",
      method: "POST",
      path: "/occurrences/{id}/unrealize",
    },
    {
      id: "skipOccurrence",
      method: "POST",
      path: "/occurrences/{id}/skip",
      body: () => ({ reason: "Not this month" }),
    },
    {
      id: "moveOccurrence",
      method: "POST",
      path: "/occurrences/{id}/move",
      body: (r) => ({ date: r.today }),
    },
    {
      id: "changeScheduleTerms",
      method: "POST",
      path: "/schedules/{id}/terms",
      body: (r) => ({
        effective_from: r.today,
        amount: money(r, -260000),
        recurrence: recurrence(r),
      }),
    },
    {
      id: "pauseSchedule",
      method: "POST",
      path: "/schedules/{id}/pauses",
      body: (r) => ({ from: r.today, to: r.today }),
    },
    {
      id: "endSchedule",
      method: "POST",
      path: "/schedules/{id}/end",
      body: (r) => ({ from: r.today }),
    },
    {
      id: "getCommitted",
      method: "GET",
      path: "/commitments",
      query: ["month"],
    },
  ],
  planning: [
    { id: "listBudgets", method: "GET", path: "/budgets", query: page },
    {
      id: "createBudget",
      method: "POST",
      path: "/budgets",
      body: (r) => ({
        category_id: r.account("expense"),
        amount: money(r, 80000),
        effective_from: r.month,
        rollover: false,
      }),
    },
    { id: "getBudget", method: "GET", path: "/budgets/{id}" },
    {
      id: "addBudgetAmount",
      method: "POST",
      path: "/budgets/{id}/amounts",
      body: (r) => ({ effective_from: r.month, amount: money(r, 90000) }),
    },
    {
      id: "getBudgetProgress",
      method: "GET",
      path: "/budgets/{id}/progress",
      query: ["month"],
    },
    { id: "listGoals", method: "GET", path: "/goals", query: page },
    {
      id: "createGoal",
      method: "POST",
      path: "/goals",
      body: (r) => ({
        name: "Emergency fund",
        target: money(r, 2000000),
        due_on: r.today,
        account_ids: [r.account("savings")],
      }),
    },
    { id: "getGoal", method: "GET", path: "/goals/{id}" },
  ],
  registry: [
    { id: "getCurrentUser", method: "GET", path: "/me" },
    {
      id: "updateCurrentUser",
      method: "PATCH",
      path: "/me",
      body: () => ({ language: "pt", region: "BR" }),
    },
    { id: "getSettings", method: "GET", path: "/settings" },
    {
      id: "updateSettings",
      method: "PUT",
      path: "/settings",
      body: (r) => ({ base_currency: r.currency }),
    },
    {
      id: "listInstitutions",
      method: "GET",
      path: "/institutions",
      query: page,
    },
    {
      id: "createInstitution",
      method: "POST",
      path: "/institutions",
      body: () => ({ name: "Bank", code: "001" }),
    },
    {
      id: "setInstitutionIdentifier",
      method: "PUT",
      path: "/institutions/{id}/identifier",
      body: () => ({ scheme: "br_ispb", identifier: "00000000" }),
    },
    {
      id: "listInstitutionIdentifierSchemes",
      method: "GET",
      path: "/institution-identifier-schemes",
    },
    { id: "listPayees", method: "GET", path: "/payees", query: page },
    {
      id: "createPayee",
      method: "POST",
      path: "/payees",
      body: () => ({ name: "Payee" }),
    },
    {
      id: "renamePayee",
      method: "PATCH",
      path: "/payees/{id}",
      body: () => ({ name: "Renamed" }),
    },
    {
      id: "mergePayee",
      method: "POST",
      path: "/payees/{id}/merge",
      body: () => ({ into: "" }),
    },
    { id: "listTags", method: "GET", path: "/tags", query: page },
    {
      id: "listInstruments",
      method: "GET",
      path: "/instruments",
      query: ["type"],
    },
    {
      id: "defineInstrument",
      method: "POST",
      path: "/instruments",
      body: (r) => ({
        code: "PETR4",
        type: "stock",
        scale: 0,
        name: "Petrobras PN",
        quote_currency: r.currency,
        exchange: "BVMF",
      }),
    },
    { id: "getInstrument", method: "GET", path: "/instruments/{code}" },
    {
      id: "listPrices",
      method: "GET",
      path: "/prices",
      query: ["instrument", "quote_instrument", "from", "to"],
    },
    {
      id: "recordPrice",
      method: "POST",
      path: "/prices",
      body: (r) => ({
        instrument: "USD",
        quote_instrument: r.currency,
        date: r.today,
        value: "5.4321",
      }),
    },
    {
      id: "listCalendars",
      method: "GET",
      path: "/calendars",
    },
    {
      id: "listHolidays",
      method: "GET",
      path: "/calendars/{name}/holidays",
      query: ["year"],
    },
  ],
  reconciliation: [
    {
      id: "listBalanceAssertions",
      method: "GET",
      path: "/accounts/{id}/balance-assertions",
      query: page,
    },
    {
      id: "createBalanceAssertion",
      method: "POST",
      path: "/accounts/{id}/balance-assertions",
      body: (r) => ({
        date: r.today,
        amount: money(r, 100000),
        source: "manual",
      }),
    },
    {
      id: "resolveBalanceAssertion",
      method: "POST",
      path: "/balance-assertions/{id}/resolve",
      body: () => ({ resolution: "adjustment" }),
    },
    {
      id: "getReconciliationStatus",
      method: "GET",
      path: "/accounts/{id}/reconciliation",
    },
    {
      id: "unlockAccount",
      method: "POST",
      path: "/accounts/{id}/unlock",
      body: (r) => ({ from: r.today }),
    },
  ],
  categorization: [
    { id: "listRules", method: "GET", path: "/rules", query: page },
    {
      id: "createRule",
      method: "POST",
      path: "/rules",
      body: (r) => ({
        name: "Groceries",
        conditions: [
          { field: "description", operator: "contains", value: "market" },
        ],
        actions: [{ type: "set_category", category_id: r.account("expense") }],
      }),
    },
    { id: "getRule", method: "GET", path: "/rules/{id}" },
    {
      id: "changeRule",
      method: "PUT",
      path: "/rules/{id}",
      body: (r) => ({
        name: "Groceries",
        conditions: [
          { field: "description", operator: "contains", value: "market" },
        ],
        actions: [{ type: "set_category", category_id: r.account("expense") }],
      }),
    },
    { id: "deleteRule", method: "DELETE", path: "/rules/{id}" },
    {
      id: "reorderRules",
      method: "POST",
      path: "/rules/reorder",
      body: () => ({ rule_ids: [] }),
    },
    {
      id: "previewRule",
      method: "POST",
      path: "/rules/preview",
      body: (r) => ({
        name: "Groceries",
        conditions: [
          { field: "description", operator: "contains", value: "market" },
        ],
        actions: [{ type: "set_category", category_id: r.account("expense") }],
      }),
    },
    { id: "runRules", method: "POST", path: "/rules/run" },
    {
      id: "getCategorization",
      method: "GET",
      path: "/transactions/{id}/categorization",
    },
    {
      id: "listCategorizations",
      method: "GET",
      path: "/categorizations",
      query: ["transaction_id"],
    },
    {
      id: "categorizeTransactions",
      method: "POST",
      path: "/transactions/categorize",
      body: (r) => ({
        category_id: r.account("expense"),
        items: [{ id: "", expected_version: 1 }],
      }),
    },
    {
      id: "getCategoryTotals",
      method: "GET",
      path: "/reports/categories",
      query: ["from", "to", "class"],
    },
    {
      id: "getCategorizationStatistics",
      method: "GET",
      path: "/categorization-statistics",
      query: ["from", "to"],
    },
    {
      id: "listRuleSuggestions",
      method: "GET",
      path: "/rule-suggestions",
      query: [...page, "state"],
    },
    {
      id: "acceptRuleSuggestion",
      method: "POST",
      path: "/rule-suggestions/{id}/accept",
      body: () => ({ name: "Suggested rule" }),
    },
    {
      id: "dismissRuleSuggestion",
      method: "POST",
      path: "/rule-suggestions/{id}/dismiss",
    },
    {
      id: "listSourceCategories",
      method: "GET",
      path: "/source-categories",
      query: page,
    },
    {
      id: "mapSourceCategory",
      method: "PUT",
      path: "/source-categories/{id}",
      body: (r) => ({ category_id: r.account("expense") }),
    },
    {
      id: "listPayeeAliases",
      method: "GET",
      path: "/payee-aliases",
      query: page,
    },
    {
      id: "createPayeeAlias",
      method: "POST",
      path: "/payee-aliases",
      body: () => ({
        pattern: "IFOOD",
        match_type: "starts_with",
        payee_id: "",
      }),
    },
    { id: "getPayeeAlias", method: "GET", path: "/payee-aliases/{id}" },
    {
      id: "changePayeeAlias",
      method: "PUT",
      path: "/payee-aliases/{id}",
      body: () => ({
        pattern: "IFOOD",
        match_type: "starts_with",
        payee_id: "",
      }),
    },
    { id: "deletePayeeAlias", method: "DELETE", path: "/payee-aliases/{id}" },
  ],
  ingestion: [
    {
      id: "listImportBatches",
      method: "GET",
      path: "/import-batches",
      query: page,
    },
    { id: "getImportBatch", method: "GET", path: "/import-batches/{id}" },
    {
      id: "listBatchRecords",
      method: "GET",
      path: "/import-batches/{id}/records",
      query: ["state", ...page],
    },
    {
      id: "resolveExternalRecord",
      method: "POST",
      path: "/external-records/{id}/resolve",
      body: () => ({ action: "create" }),
    },
    {
      id: "listUnconfirmed",
      method: "GET",
      path: "/accounts/{id}/unconfirmed",
    },
    { id: "getCsvProfile", method: "GET", path: "/accounts/{id}/csv-profile" },
    {
      id: "saveCsvProfile",
      method: "PUT",
      path: "/accounts/{id}/csv-profile",
      body: () => ({
        delimiter: "semicolon",
        header_rows: 1,
        date_column: "Data",
        date_layout: "DD/MM/YYYY",
        amount_column: "Valor",
        decimal_separator: ",",
        description_column: "Descrição",
      }),
    },
    { id: "listAggregators", method: "GET", path: "/aggregators" },
    {
      id: "listIntegrations",
      method: "GET",
      path: "/integrations",
      query: page,
    },
    {
      id: "createIntegration",
      method: "POST",
      path: "/integrations",
      body: (r) => ({
        aggregator: r.aggregator?.id ?? "",
        name: r.aggregator?.name ?? "",
        credentials: r.aggregator?.credentials ?? {},
      }),
    },
    { id: "getIntegration", method: "GET", path: "/integrations/{id}" },
    { id: "deleteIntegration", method: "DELETE", path: "/integrations/{id}" },
    {
      id: "updateIntegrationCredentials",
      method: "PUT",
      path: "/integrations/{id}/credentials",
      body: (r) => r.aggregator?.credentials ?? {},
    },
    { id: "listConnections", method: "GET", path: "/connections", query: page },
    {
      id: "createConnection",
      method: "POST",
      path: "/connections",
      body: () => ({ integration_id: "", external_id: "" }),
    },
    { id: "getConnection", method: "GET", path: "/connections/{id}" },
    { id: "deleteConnection", method: "DELETE", path: "/connections/{id}" },
    { id: "syncConnection", method: "POST", path: "/connections/{id}/sync" },
    {
      id: "mapExternalAccount",
      method: "PUT",
      path: "/connections/{id}/accounts/{external_account_id}",
      body: (r) => ({ account_id: r.account("checking"), sync_from: r.today }),
    },
  ],
  investments: [
    { id: "listPositions", method: "GET", path: "/positions", query: ["date"] },
    {
      id: "listRealizedResults",
      method: "GET",
      path: "/realized-results",
      query: ["year"],
    },
    {
      id: "listIncomeEvents",
      method: "GET",
      path: "/income-events",
      query: ["year"],
    },
    {
      id: "listInvestmentIncomeTypes",
      method: "GET",
      path: "/investment-income-types",
    },
    {
      id: "recordTrade",
      method: "POST",
      path: "/trades",
      body: (r) => ({
        account_id: r.account("brokerage"),
        cash_account_id: r.account("checking"),
        side: "buy",
        date: r.today,
        quantity: { amount: 100, currency: "PETR4" },
        unit_price: "38.50",
      }),
    },
    {
      id: "recordInvestmentIncome",
      method: "POST",
      path: "/investment-income",
      body: (r) => ({
        account_id: r.account("brokerage"),
        cash_account_id: r.account("checking"),
        income_type: "dividend",
        date: r.today,
        gross: money(r, 12000),
        category_id: r.account("income"),
      }),
    },
  ],
};
