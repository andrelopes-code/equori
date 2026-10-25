import {
  accountRoutes,
  checkingID,
  foodID,
  money,
} from "@/testing/account-api";
import { fakeApi, json } from "@/testing/fake-api";

type Route = (req: Request) => Response | Promise<Response>;

function terms(from: string, amount: number, recurrence: object) {
  return {
    effective_from: from,
    amount: money(amount),
    recurrence: {
      frequency: "monthly",
      interval: 1,
      adjustment: "none",
      ...recurrence,
    },
  };
}

export function schedule(
  id: string,
  kind: string,
  description: string,
  versions: ReturnType<typeof terms>[],
  extra: Record<string, unknown> = {},
) {
  return {
    id,
    kind,
    calendar: "br_banking",
    account_id: checkingID,
    counterpart_id: foodID,
    description,
    match_tolerance_bp: 1000,
    grace_days: 3,
    terms: versions,
    pauses: [],
    ...extra,
  };
}

export const rentID = "e1000000-0000-4000-8000-000000000001";
export const salaryID = "e1000000-0000-4000-8000-000000000002";
export const streamingID = "e1000000-0000-4000-8000-000000000003";
// S27 rent, S62 salary and S29 streaming.
export const rent = schedule(rentID, "bill", "Rent", [
  terms("2026-01-05", 210000, {
    day_of_month: 5,
    adjustment: "following",
    start: "2026-01-05",
  }),
]);
export const salarySchedule = schedule(salaryID, "income", "Salary", [
  terms("2026-01-01", 500000, { business_day_ordinal: 5, start: "2026-01-01" }),
]);
export const streamingSchedule = schedule(
  streamingID,
  "subscription",
  "Streaming",
  [
    terms("2026-01-12", 3990, { day_of_month: 12, start: "2026-01-12" }),
    terms("2027-01-01", 4490, { day_of_month: 12, start: "2026-01-12" }),
  ],
  {
    pauses: [{ from: "2027-02-01", to: "2027-03-31" }],
    ends_on: "2027-06-01",
  },
);
export const schedules = [rent, salarySchedule, streamingSchedule];

export function occurrence(
  id: string,
  scheduleID: string,
  date: string,
  amount: number,
  state: string,
) {
  return {
    id: `f1000000-0000-4000-8000-00000000000${id}`,
    schedule_id: scheduleID,
    sequence: 1,
    expected_on: date,
    expected_amount: money(amount),
    state,
  };
}

export const rentSeptember = occurrence(
  "1",
  rentID,
  "2026-09-05",
  210000,
  "overdue",
);
export const rentOctober = occurrence(
  "2",
  rentID,
  "2026-10-05",
  210000,
  "overdue",
);
export const streaming = occurrence(
  "3",
  streamingID,
  "2026-10-12",
  3990,
  "realized",
);
export const salary = occurrence(
  "4",
  salaryID,
  "2026-10-20",
  500000,
  "expected",
);

export function transaction(id: string, date: string, amount: number) {
  return {
    id,
    date,
    description: id,
    balancing_currency: "BRL",
    origin: "manual",
    version: 1,
    tags: [],
    links: [],
    postings: [
      {
        id: `${id}-1`,
        account_id: checkingID,
        amount: money(amount),
        weight: money(amount),
        status: "cleared",
      },
    ],
  };
}

export const exactID = "a9000000-0000-4000-8000-000000000001";
export const farID = "a9000000-0000-4000-8000-000000000002";

export const calendarList = {
  default: "br_banking",
  items: [
    { id: "br_banking", weekend: ["saturday", "sunday"] },
    { id: "weekend", weekend: ["saturday", "sunday"] },
  ],
};

export function planningApi(overrides: Record<string, Route> = {}) {
  return fakeApi(
    accountRoutes({
      "GET /api/v1/calendars": () => json(200, calendarList),
      "GET /api/v1/schedules": () => json(200, { items: schedules }),
      ...Object.fromEntries(
        schedules.map((s) => [
          `GET /api/v1/schedules/${s.id}`,
          () => json(200, s),
        ]),
      ),
      "GET /api/v1/occurrences": (req) =>
        new URL(req.url).searchParams.get("state") === "overdue"
          ? json(200, { items: [rentSeptember, rentOctober] })
          : json(200, { items: [rentOctober, streaming, salary] }),
      "GET /api/v1/transactions": () =>
        json(200, {
          items: [
            transaction(farID, "2026-10-04", -150000),
            transaction(exactID, "2026-10-06", -210000),
          ],
        }),
      ...overrides,
    }),
  );
}
