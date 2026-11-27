import { divideHalfEven } from "@/features/transactions/entry-model/trade-math";

// FC3: each part in minor units of the cash currency converts on its own, half to even, and the
// converted parts add up. The rate is the canonical decimal of base currency per cash unit.
export function baseAmount(
  parts: readonly number[],
  cashScale: number,
  rate: string,
  baseScale: number,
): number {
  const [whole = "0", fraction = ""] = rate.split(".");
  const numerator = BigInt(whole + fraction) * 10n ** BigInt(baseScale);
  const denominator = 10n ** BigInt(cashScale + fraction.length);

  return parts.reduce((sum, part) => {
    const converted = divideHalfEven(
      BigInt(Math.abs(part)) * numerator,
      denominator,
    );

    return sum + (part < 0 ? -Number(converted) : Number(converted));
  }, 0);
}

// The base amount of the cash a trade moves: the sign of each part follows the cash effect, and
// an opening states its cost, so its parts are unsigned.
export function tradeBaseAmount(
  side: "buy" | "sell" | "opening",
  parts: { gross: number; fees: number; taxes: number },
  cashScale: number,
  rate: string,
  baseScale: number,
): number {
  const { gross, fees, taxes } = parts;
  const signed = {
    buy: [-gross, -fees],
    sell: [gross, -fees, -taxes],
    opening: [gross, fees],
  };

  return baseAmount(signed[side], cashScale, rate, baseScale);
}
