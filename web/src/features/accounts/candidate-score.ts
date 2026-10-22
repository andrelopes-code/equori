import type { components } from "@/api/schema.gen";
import type { MessageKey } from "@/i18n/catalog.en";

type ScoredCandidate = components["schemas"]["ScoredCandidate"];

export interface Criterion {
  label: MessageKey;
  level: MessageKey;
  points: number;
  max: number;
}

// The weights of internal/ingestion/internal/domain/match.go (A98–A100): the candidate's score
// is the sum of its three criteria.
const amountPoints = { identical: 6, close: 3, bounded: -2 } as const;
const datePoints = { same_day: 3, near: 2, far: -1 } as const;
const counterpartyPoints = {
  same_payee: 4,
  other_payee: -6,
  similar_description: 2,
  unknown: 0,
} as const;

// A100: a score from 8 links on its own, from 4 waits for review, below 4 is no candidate.
export const linkScore = 8;
export const reviewScore = 4;

export function criteria(candidate: ScoredCandidate): Criterion[] {
  return [
    {
      label: "batch.criterion.amount",
      level: `batch.criterion.amount.${candidate.amount}`,
      points: amountPoints[candidate.amount],
      max: amountPoints.identical,
    },
    {
      label: "batch.criterion.date",
      level: `batch.criterion.date.${candidate.date}`,
      points: datePoints[candidate.date],
      max: datePoints.same_day,
    },
    {
      label: "batch.criterion.counterparty",
      level: `batch.criterion.counterparty.${candidate.counterparty}`,
      points: counterpartyPoints[candidate.counterparty],
      max: counterpartyPoints.same_payee,
    },
  ];
}
