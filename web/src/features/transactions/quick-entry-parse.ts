import { parseAmount, shiftDate } from "@/i18n/format";

export interface EntryAccount {
  id: string;
  name: string;
  class: string;
  kind?: string | undefined;
}

export interface EntryContext {
  today: string;
  scale: number;
  accounts: EntryAccount[];
  history?: { description: string; categoryId: string }[];
  // The account a line without an account word posts to, such as the account open on screen.
  defaultAccountId?: string | undefined;
}

export interface EntryParse {
  amount: number | null;
  date: string;
  dateWord: "today" | "yesterday" | "before" | null;
  mode: "expense" | "income";
  accountId: string | null;
  categoryId: string | null;
  description: string;
}

type DateWord = NonNullable<EntryParse["dateWord"]>;

const dateWords: Record<string, { word: DateWord; days: number }> = {
  hoje: { word: "today", days: 0 },
  today: { word: "today", days: 0 },
  ontem: { word: "yesterday", days: -1 },
  yesterday: { word: "yesterday", days: -1 },
  anteontem: { word: "before", days: -2 },
};

const incomeWords = new Set([
  "recebi",
  "receita",
  "recebido",
  "salario",
  "freela",
  "received",
  "income",
  "salary",
]);

const incomeVerbs = new Set(["recebi", "received"]);

const cardWords = new Set(["cartao", "credito", "card", "credit"]);
const cashWords = new Set(["dinheiro", "carteira", "cash", "wallet"]);

const connectors = new Set([
  "de",
  "do",
  "da",
  "no",
  "na",
  "em",
  "com",
  "para",
  "pra",
  "on",
  "at",
  "for",
  "in",
  "with",
  "the",
  "a",
  "o",
]);

const keywords: { words: string[]; stems: string[] }[] = [
  {
    words: ["almoco", "jantar", "lanche", "restaurante", "lunch", "dinner"],
    stems: ["restaurante", "alimenta", "restaurant", "food"],
  },
  {
    words: [
      "uber",
      "99",
      "taxi",
      "onibus",
      "metro",
      "gasolina",
      "combustivel",
      "fuel",
    ],
    stems: ["transporte", "transport"],
  },
  {
    words: ["mercado", "supermercado", "feira", "grocery"],
    stems: ["mercado", "supermercado", "grocer"],
  },
  { words: ["farmacia", "remedio"], stems: ["farm", "saude", "health"] },
  {
    words: ["freela", "salario", "freelance", "salary"],
    stems: ["renda", "salario", "freela", "income", "salary"],
  },
  {
    words: ["aluguel", "rent"],
    stems: ["moradia", "aluguel", "housing", "rent"],
  },
  {
    words: ["netflix", "spotify", "assinatura"],
    stems: ["assinatura", "subscription", "lazer"],
  },
];

function normalize(text: string): string {
  return text.toLowerCase().normalize("NFD").replace(/\p{M}/gu, "");
}

function key(word: string): string {
  return normalize(word).replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, "");
}

function toMinor(token: string, scale: number): number | null {
  const trimmed = token.replace(/[.,]+$/, "");
  const n =
    parseAmount(trimmed, scale, "pt-BR") ?? parseAmount(trimmed, scale, "en");
  return n !== null && n > 0 ? n : null;
}

function categoryOf(
  accounts: EntryAccount[],
  id: string,
  cls: string,
): string | null {
  return accounts.some((a) => a.id === id && a.class === cls) ? id : null;
}

function pickAccount(
  accounts: EntryAccount[],
  words: Set<string>,
  fallback: string | undefined,
): string | null {
  const wants = (set: Set<string>) => [...words].some((w) => set.has(w));
  const byKind = (kind: string) => accounts.find((a) => a.kind === kind)?.id;
  const requested = wants(cardWords)
    ? byKind("credit_card")
    : wants(cashWords)
      ? byKind("cash")
      : undefined;
  return (
    requested ??
    accounts.find((a) => a.id === fallback)?.id ??
    byKind("checking") ??
    accounts.find((a) => a.class === "asset")?.id ??
    null
  );
}

function pickCategory(
  ctx: EntryContext,
  cls: string,
  description: string,
  words: string[],
): string | null {
  const normalizedDescription = normalize(description);
  if (normalizedDescription !== "") {
    for (const h of ctx.history ?? []) {
      if (normalize(h.description) !== normalizedDescription) continue;
      const id = categoryOf(ctx.accounts, h.categoryId, cls);
      if (id !== null) return id;
    }
  }

  const categories = ctx.accounts.filter((a) => a.class === cls);
  for (const entry of keywords) {
    if (!words.some((w) => entry.words.includes(w))) continue;
    const hit = categories.find((c) => {
      const name = normalize(c.name);
      return entry.stems.some((s) => name.includes(s));
    });
    if (hit !== undefined) return hit.id;
  }

  const named = categories.find((c) => {
    const name = normalize(c.name);
    return name !== "" && words.some((w) => w === name || w.includes(name));
  });
  return named?.id ?? null;
}

export function parseEntry(text: string, ctx: EntryContext): EntryParse {
  const tokens = text.split(/\s+/).filter((t) => t !== "");

  let amount: number | null = null;
  let amountIndex = -1;
  tokens.forEach((token, i) => {
    if (amountIndex >= 0) return;
    const m = /\d[\d.,]*/.exec(token);
    if (m === null) return;
    amountIndex = i;
    amount = toMinor(m[0], ctx.scale);
  });

  let date = ctx.today;
  let dateWord: EntryParse["dateWord"] = null;
  const rest: { raw: string; word: string }[] = [];
  const present = new Set<string>();
  tokens.forEach((token, i) => {
    if (i === amountIndex) return;
    const word = key(token);
    present.add(word);
    const when = dateWords[word];
    if (when !== undefined) {
      date = shiftDate(ctx.today, when.days);
      dateWord = when.word;
      return;
    }
    rest.push({ raw: token, word });
  });

  const padded = ` ${[...present].join(" ")} `;
  const income =
    [...present].some((w) => incomeWords.has(w)) ||
    padded.includes(" paid me ");
  const mode = income ? "income" : "expense";

  const description = rest
    .filter(
      ({ word }) =>
        !cardWords.has(word) &&
        !cashWords.has(word) &&
        !incomeVerbs.has(word) &&
        !connectors.has(word),
    )
    .map(({ raw }) => raw)
    .join(" ");
  const cased =
    description === ""
      ? ""
      : description.charAt(0).toUpperCase() + description.slice(1);

  return {
    amount,
    date,
    dateWord,
    mode,
    accountId: pickAccount(ctx.accounts, present, ctx.defaultAccountId),
    categoryId: pickCategory(
      ctx,
      mode,
      cased,
      rest.map(({ word }) => word),
    ),
    description: cased,
  };
}
