import { describe, expect, it } from "vitest";

import { formatMoment } from "@/features/setup/format-moment";

describe("formatMoment", () => {
  const iso = "2026-11-20T02:30:00Z";

  it("writes the instant in the time zone of the books", () => {
    const text = formatMoment(iso, "pt-BR", "America/Sao_Paulo");

    expect(text).toBe(
      new Intl.DateTimeFormat("pt-BR", {
        dateStyle: "medium",
        timeStyle: "short",
        timeZone: "America/Sao_Paulo",
      }).format(new Date(iso)),
    );
    expect(text).toContain("19 de nov.");
  });

  it("moves to the next day in UTC", () => {
    expect(formatMoment(iso, "pt-BR", "UTC")).toContain("20 de nov.");
  });
});
