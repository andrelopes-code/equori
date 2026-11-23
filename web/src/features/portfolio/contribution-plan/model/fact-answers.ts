export type FactAnswer = "yes" | "no" | "none";

// The keys of the nine signals of Piotroski, P1 to P9 (FQ2).
export const piotroskiFacts: readonly string[] = [
  "piotroski_p1",
  "piotroski_p2",
  "piotroski_p3",
  "piotroski_p4",
  "piotroski_p5",
  "piotroski_p6",
  "piotroski_p7",
  "piotroski_p8",
  "piotroski_p9",
];

// The answers CQ3 counts: the fact where the filings decide, else the investor's (FQ4).
export function effectiveAnswers(
  answers: boolean[],
  factAnswers: FactAnswer[] | undefined,
): boolean[] {
  return answers.map((answer, q) =>
    factDecides(factAnswers, q) ? factAnswers?.[q] === "yes" : answer,
  );
}

// Whether the filings decide the answer of question q.
export function factDecides(
  factAnswers: FactAnswer[] | undefined,
  q: number,
): boolean {
  const fact = factAnswers?.[q];

  return fact === "yes" || fact === "no";
}
