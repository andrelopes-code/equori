import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { I18nProvider } from "@/i18n/i18n-provider";
import { PrivacyProvider } from "@/privacy/privacy-provider";
import { FigureCard } from "@/ui/figure-card";

describe("FigureCard", () => {
  it.each(["warning", "danger"] as const)(
    "marks a %s figure without changing the tone of its delta",
    (attention) => {
      renderCard(attention);

      const card = screen.getByRole("group", { name: "Uptime" });

      expect(card).toHaveAttribute("data-attention", attention);
      expect(card.querySelector("[data-part-delta]")).toHaveAttribute(
        "data-tone",
        "success",
      );
    },
  );

  it("marks nothing without attention", () => {
    renderCard(undefined);

    const card = screen.getByRole("group", { name: "Uptime" });

    expect(card).not.toHaveAttribute("data-attention");
  });
});

function renderCard(attention: "warning" | "danger" | undefined) {
  return render(
    <I18nProvider locale={{ language: "en", region: "US" }}>
      <PrivacyProvider>
        <FigureCard
          label="Uptime"
          value="91%"
          note="Below the 95% target"
          delta={0.08}
          {...(attention === undefined ? {} : { attention })}
        />
      </PrivacyProvider>
    </I18nProvider>,
  );
}
