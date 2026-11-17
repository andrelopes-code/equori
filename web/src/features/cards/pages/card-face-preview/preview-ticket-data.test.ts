import { describe, expect, it } from "vitest";

import { statementLead } from "@/features/cards/card-tile/statement-lead";
import { ticketSamples } from "@/features/cards/pages/card-face-preview/preview-ticket-data";

describe("ticketSamples", () => {
  it.each(["2026-11-17", "2027-03-31"])(
    "leads each state with its word on %s",
    (today) => {
      const words = ticketSamples(today).map((sample) => [
        sample.key,
        statementLead(sample.current, sample.unpaid, today)?.word,
      ]);

      expect(words).toEqual([
        ["to-pay", "due"],
        ["due-soon", "soon"],
        ["overdue", "overdue"],
        ["paid-in-part", "partial"],
        ["open-only", "open"],
        ["no-statement", undefined],
        ["loading", undefined],
      ]);
    },
  );

  it("derives the reference from the closing date", () => {
    const [toPay] = ticketSamples("2026-11-17");

    expect(toPay?.unpaid[0]?.reference).toBe("2026-11");
    expect(toPay?.unpaid[0]?.closing_date).toBe("2026-11-10");
    expect(toPay?.unpaid[0]?.due_date).toBe("2026-11-25");
    expect(toPay?.current?.closing_date).toBe("2026-12-10");
  });

  it("gives a week signal to the five states that draw one", () => {
    const signals = ticketSamples("2026-11-17").map((s) => s.signal?.length);

    expect(signals).toEqual([6, 6, 6, 6, 6, undefined, undefined]);
  });

  it("leaves the available limit below zero when the limit is exceeded", () => {
    const soon = ticketSamples("2026-11-17")[1];

    expect(soon?.account.card?.available_limit?.amount).toBe(-40000);
  });
});
