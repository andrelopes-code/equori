import { breakEven } from "@/features/calculators/indexer-comparison/break-even";
import type { ComparisonRow } from "@/features/calculators/indexer-comparison/compare";
import type {
  IndexData,
  Security,
} from "@/features/calculators/indexer-comparison/security";

export type IndexerAnswer =
  | { kind: "single" }
  // The two largest final values are equal.
  | { kind: "equal"; final: number; netRate: number }
  | {
      kind: "leader";
      // Positions in the typed order.
      winner: number;
      next: number;
      // Minor units: the amount plus the net yield.
      final: number;
      // Integer subtraction of the final values of the winner and the next.
      difference: number;
      netRate: number;
      breakEven: number | null;
    };

// IC3 read as an answer: the security with the largest final value and its gap to the second
// largest. Null while no security has a rate; a single answer while only one has.
export function indexerAnswer(input: {
  amount: number;
  securities: readonly Security[];
  rows: readonly (ComparisonRow | null)[];
  indexes: ReadonlyMap<string, IndexData>;
  days: number;
  taxBp: number;
}): IndexerAnswer | null {
  const { amount, rows } = input;
  const ranked = rows
    .flatMap((row, position) =>
      row === null ? [] : [{ position, row, final: amount + row.net }],
    )
    .sort((a, b) => b.final - a.final || a.position - b.position);
  const [top, second] = ranked;
  if (top === undefined) return null;
  if (second === undefined) return { kind: "single" };

  const difference = top.final - second.final;
  if (difference === 0)
    return { kind: "equal", final: top.final, netRate: top.row.netAnnualRate };

  return {
    kind: "leader",
    winner: top.position,
    next: second.position,
    final: top.final,
    difference,
    netRate: top.row.netAnnualRate,
    breakEven: pairBreakEven(input, top.position, second.position),
  };
}

// The index rate at which the floating one of the two ties with the other; the winner's own
// when both float.
function pairBreakEven(
  input: Parameters<typeof indexerAnswer>[0],
  winner: number,
  next: number,
): number | null {
  const { securities, rows, indexes } = input;
  const winnerFloats = securities[winner]?.form !== "fixed";
  const [floating, other] = winnerFloats ? [winner, next] : [next, winner];
  const security = securities[floating];
  const reference = securities[other];
  const referenceRate = rows[other]?.annualRate;
  const data =
    security?.index === undefined ? undefined : indexes.get(security.index);
  if (
    security === undefined ||
    reference === undefined ||
    referenceRate === undefined ||
    data === undefined
  )
    return null;

  return breakEven({
    security,
    data,
    reference,
    referenceRate,
    days: input.days,
    taxBp: input.taxBp,
  });
}
