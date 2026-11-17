import type { components } from "@/api/schema.gen";
import { shiftDate } from "@/i18n/format";
import type { CardFaceProps } from "@/ui/card-face/card-face";

type Account = components["schemas"]["Account"];
type Statement = components["schemas"]["StatementSummary"];

export interface TicketSample {
  key: string;
  face: CardFaceProps;
  account: Account;
  current: Statement | undefined;
  unpaid: Statement[];
  signal: number[] | undefined;
  loading: boolean;
}

interface Closed {
  owing: number;
  unpaid: number;
  closedAgo: number;
  dueIn: number;
  status: Statement["status"];
}

interface Open {
  amount: number;
  closesIn: number;
  dueIn: number;
}

interface Sample {
  key: string;
  face: Omit<CardFaceProps, "holder">;
  limit?: { total: number; used: number };
  closed?: Closed;
  open?: Open;
  signal?: boolean;
  loading?: boolean;
}

const currency = "BRL";
const holder = "André Lopes";
const week = [4200, 0, 12990, 3150, 8800, 0];

// The seven states of the ticket; every date is a number of days from today, so each state holds
// on any day.
const samples: Sample[] = [
  {
    key: "to-pay",
    face: {
      title: "Nubank Ultravioleta",
      color: "#820ad1",
      art: "aurora",
      network: "mastercard",
      chip: "silver",
      lastFour: "4821",
    },
    limit: { total: 1000000, used: 512300 },
    closed: {
      owing: 184277,
      unpaid: 184277,
      closedAgo: 7,
      dueIn: 8,
      status: "closed",
    },
    open: { amount: 62340, closesIn: 23, dueIn: 30 },
    signal: true,
  },
  {
    key: "due-soon",
    face: {
      title: "Inter Black",
      color: "#ff7a00",
      art: "contour",
      network: "mastercard",
      lastFour: "7712",
    },
    limit: { total: 1000000, used: 1040000 },
    closed: {
      owing: 812000,
      unpaid: 812000,
      closedAgo: 8,
      dueIn: 2,
      status: "closed",
    },
    open: { amount: 228000, closesIn: 22, dueIn: 29 },
    signal: true,
  },
  {
    key: "overdue",
    face: {
      title: "Itaú Personnalité Black Pontos Internacional",
      color: "#ec7000",
      art: "waves",
      network: "hipercard",
      lastFour: "0937",
    },
    limit: { total: 700000, used: 623410 },
    closed: {
      owing: 95000,
      unpaid: 95000,
      closedAgo: 27,
      dueIn: -20,
      status: "overdue",
    },
    open: { amount: 528410, closesIn: 4, dueIn: 11 },
    signal: true,
  },
  {
    key: "paid-in-part",
    face: {
      title: "Bradesco Prime",
      color: "#cc092f",
      art: "orbits",
      network: "visa",
      lastFour: "5540",
    },
    limit: { total: 500000, used: 100990 },
    closed: {
      owing: 95000,
      unpaid: 55000,
      closedAgo: 14,
      dueIn: 9,
      status: "partially_paid",
    },
    open: { amount: 45990, closesIn: 16, dueIn: 23 },
    signal: true,
  },
  {
    key: "open-only",
    face: {
      title: "C6 Carbon",
      color: "#1b1b1f",
      art: "dots",
      network: "mastercard",
      chip: "silver",
      lastFour: "2090",
    },
    limit: { total: 800000, used: 31250 },
    open: { amount: 31250, closesIn: 14, dueIn: 23 },
    signal: true,
  },
  {
    key: "no-statement",
    face: {
      title: "Ourocard",
      color: "#fce300",
      art: "holo",
      network: "elo",
      lastFour: "3306",
    },
    limit: { total: 300000, used: 0 },
  },
  {
    key: "loading",
    face: { title: "Nubank Ultravioleta", color: "#820ad1", art: "aurora" },
    loading: true,
  },
];

export function ticketSamples(today: string): TicketSample[] {
  return samples.map((sample) => ({
    key: sample.key,
    face: { ...sample.face, holder, loading: sample.loading === true },
    account: account(sample),
    current: sample.open && openStatement(sample.open, today),
    unpaid: sample.closed ? [closedStatement(sample.closed, today)] : [],
    signal: sample.signal ? week : undefined,
    loading: sample.loading === true,
  }));
}

function account({ face, limit }: Sample): Account {
  const card = limit && {
    credit_limit: money(limit.total),
    available_limit: money(limit.total - limit.used),
  };

  // The ticket reads only the name, the currency and the card limit.
  return { id: face.title, name: face.title, currency, card } as Account;
}

function closedStatement(closed: Closed, today: string): Statement {
  const closing = shiftDate(today, -closed.closedAgo);

  return statement(closing, shiftDate(today, closed.dueIn), closed.status, {
    amount_due: money(closed.owing),
    unpaid: money(closed.unpaid),
  });
}

function openStatement(open: Open, today: string): Statement {
  return statement(
    shiftDate(today, open.closesIn),
    shiftDate(today, open.dueIn),
    "open",
    { open_amount: money(open.amount) },
  );
}

function statement(
  closing: string,
  due: string,
  status: Statement["status"],
  amounts: Partial<Statement>,
): Statement {
  const zero = money(0);

  // The reference is the month of the closing date, as the API sends it ("2026-10").
  return {
    id: `${status}-${closing}`,
    account_id: "preview",
    reference: closing.slice(0, 7),
    closing_date: closing,
    due_date: due,
    opening: zero,
    charges: zero,
    credits: zero,
    amount_due: zero,
    payments: zero,
    settled: zero,
    unpaid: zero,
    prior_credits: zero,
    early_payments: zero,
    billed_amount: zero,
    open_amount: zero,
    status,
    reconciled: false,
    ...amounts,
  };
}

function money(amount: number) {
  return { amount, currency };
}
