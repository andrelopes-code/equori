import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { moneyValue } from "@/testing/money-value";

describe("moneyValue", () => {
  it("finds an amount split across unit parts by the text of its value part", () => {
    render(
      <p data-part-value="">
        <span data-part-unit="">R$</span>400<span data-part-unit="">.00</span>
      </p>,
    );

    expect(screen.getByText(moneyValue("R$400.00"))).toHaveTextContent(
      "R$400.00",
    );
    expect(screen.getByText(moneyValue(/400\.00/))).toBeInTheDocument();
  });

  it("matches no element outside a value part", () => {
    render(<p>R$400.00</p>);

    expect(screen.queryByText(moneyValue("R$400.00"))).toBeNull();
  });

  it("matches no value part whose text differs", () => {
    render(<p data-part-value="">R$400.01</p>);

    expect(screen.queryByText(moneyValue("R$400.00"))).toBeNull();
  });
});
