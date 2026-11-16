import { screen, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { fakeApi } from "@/testing/fake-api";
import { renderWithProviders } from "@/testing/render-app";
import { ChoiceSelect } from "@/ui/form-fields/choice-select";

const choices = [
  { value: "BR", label: "Brazil", flag: "BR" },
  { value: "DE", label: "Germany" },
];

function select(value: string) {
  return renderWithProviders(
    <ChoiceSelect
      label="Region"
      choices={choices}
      value={value}
      multiple={false}
      onChange={() => undefined}
    />,
    { fetch: fakeApi({}) },
  );
}

describe("ChoiceSelect", () => {
  it("draws the flag of the chosen choice in the closed field", async () => {
    const { container } = select("BR");

    await screen.findByRole("combobox", { name: "Region" });

    await waitFor(() => {
      expect(container.querySelector('[data-art="BR"]')).not.toBeNull();
    });
    expect(screen.getByRole("combobox", { name: "Region" })).toHaveTextContent(
      "Brazil",
    );
  });

  it("draws no flag for a choice without one", async () => {
    const { container } = select("DE");

    await screen.findByRole("combobox", { name: "Region" });

    expect(container.querySelector("[data-art]")).toBeNull();
    expect(screen.getByRole("combobox", { name: "Region" })).toHaveTextContent(
      "Germany",
    );
  });
});
