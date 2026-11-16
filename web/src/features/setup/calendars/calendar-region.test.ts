import { describe, expect, it } from "vitest";

import { calendarRegion } from "@/features/setup/calendars/calendar-region";

describe("calendarRegion", () => {
  it("places the Brazilian banking calendar in BR", () => {
    expect(calendarRegion("br_banking")).toBe("BR");
  });

  it.each(["weekend", "gulf", "a_new_calendar"])(
    "places %s in the global region",
    (id) => {
      expect(calendarRegion(id)).toBe("global");
    },
  );
});
