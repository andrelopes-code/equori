// How two classes move together, in words (RK9). The bounds are the usual reading of Pearson's
// r: below 0.3 in size the pair is nearly independent, from 0.7 it moves together.
export type CorrelationReading =
  "independent" | "partly" | "together" | "opposite";

export function correlationReading(bp: number): CorrelationReading {
  if (bp <= -3000) return "opposite";
  if (bp < 3000) return "independent";
  if (bp < 7000) return "partly";

  return "together";
}
