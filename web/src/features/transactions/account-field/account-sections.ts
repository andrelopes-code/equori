import {
  isPrimary,
  kindRank,
} from "@/features/transactions/account-field/account-affinity";
import type { Operation } from "@/features/transactions/account-field/account-operation";
import type { AccountChoice } from "@/features/transactions/account-field/use-account-choices";
import type { MessageKey } from "@/i18n/catalog.en";

// The sections whose choices are credit cards drawn as wallet cards, two across.
export const cardSectionIds = new Set<SectionId>([
  "goesToStatement",
  "settlesStatement",
  "cards",
]);

export type SectionId =
  | "suggested"
  | "leavesBalance"
  | "entersBalance"
  | "goesToStatement"
  | "settlesStatement"
  | "accounts"
  | "cards"
  | "other";

export interface Section {
  id: SectionId;
  heading: MessageKey;
  choices: AccountChoice[];
}

interface SectionsInput {
  choices: readonly AccountChoice[];
  operation: Operation;
  compact: boolean;
  suggestedId: string | null;
  collator: Intl.Collator;
}

// R6: the sections in order, each omitted when empty.
export function sectionsOf(input: SectionsInput): Section[] {
  const { operation, compact, suggestedId, collator } = input;
  const suggested = input.choices.filter((c) => c.account.id === suggestedId);
  const rest = input.choices.filter((c) => c.account.id !== suggestedId);
  const primary = rest.filter((c) => isPrimary(operation, c.account.kind));
  const other = rest.filter((c) => !isPrimary(operation, c.account.kind));
  const cards = primary.filter((c) => c.group === "cards");
  const balances = primary.filter((c) => c.group !== "cards");
  const ids = idsOf(operation, compact);

  const sections: [SectionId, AccountChoice[]][] = [
    ["suggested", suggested],
    [ids.balance, byKind(balances, operation, collator)],
    [ids.card, byKind(cards, operation, collator)],
    ["other", byName(other, collator)],
  ];

  return sections
    .filter(([, choices]) => choices.length > 0)
    .map(([id, choices]) => ({
      id,
      heading: `accountChoice.section.${id}`,
      choices,
    }));
}

function byKind(
  choices: AccountChoice[],
  operation: Operation,
  collator: Intl.Collator,
): AccountChoice[] {
  return [...choices].sort(
    (a, b) =>
      kindRank(operation, a.account.kind) -
        kindRank(operation, b.account.kind) ||
      collator.compare(a.account.name, b.account.name),
  );
}

function byName(
  choices: AccountChoice[],
  collator: Intl.Collator,
): AccountChoice[] {
  return [...choices].sort((a, b) =>
    collator.compare(a.account.name, b.account.name),
  );
}

function idsOf(
  operation: Operation,
  compact: boolean,
): { balance: SectionId; card: SectionId } {
  if (compact) return { balance: "accounts", card: "cards" };

  if (operation === "expense" || operation === "transfer-out")
    return { balance: "leavesBalance", card: "goesToStatement" };

  return { balance: "entersBalance", card: "settlesStatement" };
}
