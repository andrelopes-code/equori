import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { components } from "@/api/schema.gen";
import { OperationBody } from "@/features/assistant/proposal/bodies/operation-body";
import { fakeApi } from "@/testing/fake-api";
import { renderWithProviders } from "@/testing/render-app";

type Preview = components["schemas"]["AssistantPreview"];

function draw(preview: Preview) {
  renderWithProviders(<OperationBody preview={preview} />, {
    fetch: fakeApi({}),
    today: "2026-11-19",
  });
}

describe("write bodies", () => {
  it("draws an unknown kind's changes as before → after", () => {
    draw({
      action: "change_transaction",
      changes: [
        {
          field: "amount",
          before: { amount: "-21.24", currency: "BRL" },
          after: { amount: "-212.40", currency: "BRL" },
        },
      ],
    });

    expect(screen.getByText(/21\.24/, { selector: "s" })).toBeInTheDocument();
    expect(screen.getByText(/212\.40/)).toBeInTheDocument();
  });

  it("draws a goal with what each month to its date must put in", () => {
    draw({
      action: "manage_budget_or_goal.create_goal",
      changes: [
        { field: "goal", after: { text: "Viagem" } },
        { field: "target", after: { amount: "15000.00", currency: "BRL" } },
        { field: "due_on", after: { date: "2027-07-31" } },
      ],
    });

    expect(screen.getByText(/= 8 × R\$\s?1,875\.00/)).toBeInTheDocument();
  });
});
