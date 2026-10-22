import { describe, expect, it } from "vitest";

import { accountCardMeter } from "@/features/accounts/account-card-meter";

describe("accountCardMeter", () => {
  it.each([
    [0, "normal", 0, "accountCard.meter.credit.free", 10000],
    [7900, "normal", 16, "accountCard.meter.credit.free", 2100],
    [8000, "alert", 16, "accountCard.meter.credit.free", 2000],
    [8900, "alert", 18, "accountCard.meter.credit.free", 1100],
    [9900, "alert", 20, "accountCard.meter.credit.free", 100],
    [10000, "over", 20, "accountCard.meter.credit.free", 0],
    [10400, "over", 20, "accountCard.meter.credit.over", 400],
  ] as const)(
    "credit used %i of 10000 → %s",
    (used, state, filled, leftKey, leftAmount) => {
      const m = accountCardMeter("credit", used, 10000);
      expect(m).toEqual({
        pct: Math.round(used / 100),
        filled,
        riskFrom: 16,
        state,
        leftKey,
        leftAmount,
        rightKey: "accountCard.meter.credit.pct",
      });
    },
  );

  it.each([
    [8900, "normal", "accountCard.meter.checking.left", 1100],
    [9000, "alert", "accountCard.meter.checking.left", 1000],
    [10000, "over", "accountCard.meter.checking.left", 0],
    [12000, "over", "accountCard.meter.checking.over", 2000],
  ] as const)(
    "checking spent %i of 10000 → %s",
    (used, state, leftKey, leftAmount) => {
      const m = accountCardMeter("checking", used, 10000);
      expect(m?.state).toBe(state);
      expect(m?.riskFrom).toBe(18);
      expect(m?.leftKey).toBe(leftKey);
      expect(m?.leftAmount).toBe(leftAmount);
      expect(m?.rightKey).toBe("accountCard.meter.checking.pct");
    },
  );

  it("reaches a savings goal at 100% and states the goal on the left", () => {
    expect(accountCardMeter("savings", 9999, 20000)).toEqual({
      pct: 50,
      filled: 10,
      riskFrom: undefined,
      state: "normal",
      leftKey: "accountCard.meter.savings.goal",
      leftAmount: 20000,
      rightKey: "accountCard.meter.savings.pct",
    });
    const reached = accountCardMeter("savings", 21000, 20000);
    expect(reached?.state).toBe("reached");
    expect(reached?.pct).toBe(105);
    expect(reached?.filled).toBe(20);
    expect(reached?.rightKey).toBe("accountCard.meter.savings.reached");
  });

  it("has no meter without a positive total, and never a negative percent", () => {
    expect(accountCardMeter("credit", 100, 0)).toBeUndefined();
    expect(accountCardMeter("credit", 100, -5)).toBeUndefined();
    expect(accountCardMeter("credit", -300, 1000)?.pct).toBe(0);
  });
});
