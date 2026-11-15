import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { beforeEach, describe, expect, it } from "vitest";

import { fakeApi } from "@/testing/fake-api";
import { renderWithProviders } from "@/testing/render-app";
import { PriceInput } from "@/ui/money/price-input";

beforeEach(() => {
  localStorage.setItem(
    "equori.locale",
    JSON.stringify({ language: "pt", region: "BR" }),
  );
});

describe("PriceInput", () => {
  it("shows the currency symbol and the price in the locale's digits when unfocused", () => {
    const { container } = renderWithProviders(
      <PriceInput
        name="price"
        value="1234.5"
        currency="BRL"
        onChange={() => undefined}
      />,
      { fetch: fakeApi({}) },
    );

    expect(screen.getByRole("textbox")).toHaveValue("1.234,5");
    expect(container).toHaveTextContent("R$");
  });

  it("reports the canonical price of what is typed and keeps an unfinished text", async () => {
    const reported: string[] = [];
    renderWithProviders(<Harness onReport={(v) => reported.push(v)} />, {
      fetch: fakeApi({}),
    });
    const input = screen.getByRole("textbox");

    await userEvent.type(input, "300,2");

    expect(input).toHaveValue("300,2");
    expect(reported.at(-1)).toBe("300.2");

    await userEvent.type(input, ",");

    expect(input).toHaveValue("300,2,");
    expect(reported.at(-1)).toBe("300.2");

    await userEvent.clear(input);

    expect(reported.at(-1)).toBe("");
  });
});

function Harness({ onReport }: { onReport: (value: string) => void }) {
  const [value, setValue] = useState("");

  return (
    <PriceInput
      name="price"
      value={value}
      currency="BRL"
      onChange={(next) => {
        setValue(next);
        onReport(next);
      }}
    />
  );
}
