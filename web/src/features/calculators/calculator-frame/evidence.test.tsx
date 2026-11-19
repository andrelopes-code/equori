import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ChoiceRows } from "@/features/calculators/calculator-frame/choice-rows";
import { FactRows } from "@/features/calculators/calculator-frame/fact-rows";
import { RangeStrip } from "@/features/calculators/calculator-frame/range-strip";
import { SplitBars } from "@/features/calculators/calculator-frame/split-bars";

describe("SplitBars", () => {
  const rows = [
    {
      name: "Price",
      parts: [30000000, 72319789],
      total: "R$ 1.023.197,89",
      label: "Price: total R$ 1.023.197,89, juros R$ 723.197,89",
    },
    {
      name: "SAC",
      parts: [30000000, 49344212],
      total: "R$ 793.442,12",
      label: "SAC: total R$ 793.442,12, juros R$ 493.442,12",
    },
  ];

  it("draws one row per entry with its label and widths on one axis", () => {
    const { container } = render(
      <SplitBars rows={rows} legend={["Valor financiado", "Juros"]} />,
    );

    const bars = screen.getAllByRole("img");
    expect(bars).toHaveLength(2);
    expect(bars[0]).toHaveAttribute("aria-label", rows[0]?.label);
    expect(bars[1]).toHaveAttribute("aria-label", rows[1]?.label);
    expect(screen.getByText("R$ 1.023.197,89")).toBeVisible();
    expect(container.querySelector("p")).toHaveTextContent(
      "Valor financiadoJuros",
    );
    const segments = bars[0]?.querySelectorAll("span > span") ?? [];
    expect((segments[0] as HTMLElement).style.inlineSize).toBe("25%");
    expect((segments[1] as HTMLElement).style.inlineSize).toBe(
      "60.26649083333333%",
    );
  });

  it("draws one part and one legend entry for each of three parts", () => {
    const { container } = render(
      <SplitBars
        rows={[
          { name: "Own", parts: [5, 3, 2], total: "10", label: "Own: 10" },
        ]}
        legend={["A", "B", "C"]}
      />,
    );

    const parts = screen.getByRole("img").querySelectorAll("span > span");

    expect(parts).toHaveLength(3);
    expect((parts[0] as HTMLElement).style.inlineSize).toBe("50%");
    expect((parts[2] as HTMLElement).style.inlineSize).toBe("20%");
    expect(container.querySelectorAll('[data-part="key"]')).toHaveLength(3);
    expect(container.querySelector("p")).toHaveTextContent("ABC");
  });

  it("renders the full name of each row and each legend entry as one element", () => {
    const names = ["Ter o imóvel", "Alugar", "Parcelas a valor presente"];
    const entries = ["Juros perdidos", "Imposto"];

    const { container } = render(
      <SplitBars
        rows={names.map((name) => ({
          name,
          parts: [5],
          total: "5",
          label: `${name}: 5`,
        }))}
        legend={entries}
      />,
    );

    names.forEach((name) => {
      expect(screen.getByText(name)).toBeVisible();
    });
    const legend = container.querySelectorAll('[data-part="legend"] > span');
    expect(Array.from(legend, (entry) => entry.textContent)).toEqual(entries);
  });

  it("draws no legend for a single part without one", () => {
    const { container } = render(
      <SplitBars
        rows={[{ name: "Own", parts: [5], total: "5", label: "Own: 5" }]}
      />,
    );

    expect(
      screen.getByRole("img").querySelectorAll("span > span"),
    ).toHaveLength(1);
    expect(container.querySelector('[data-part="legend"]')).toBeNull();
  });
});

describe("ChoiceRows", () => {
  it("draws the head, one row per option and the note", () => {
    render(
      <ChoiceRows
        head={["Opção", "Efeito", "Juros economizados"]}
        rows={[
          {
            name: "Reduzir o prazo",
            effect: "Termina em 242 meses",
            saved: 24785559,
            savedText: "R$ 247.855,59",
            label:
              "Reduzir o prazo: termina em 242 meses, economia de R$ 247.855,59",
          },
          {
            name: "Reduzir a prestação",
            effect: "Prestação cai para R$ 2.650,91",
            saved: 4428585,
            savedText: "R$ 44.285,85",
            label: "Reduzir a prestação: economia de R$ 44.285,85",
          },
        ]}
        note="Saldo depois da amortização R$ 277.104,00"
      />,
    );

    expect(screen.getByText("Opção")).toBeVisible();
    expect(screen.getByText("Juros economizados")).toBeVisible();
    const rows = screen.getAllByRole("img");
    expect(rows).toHaveLength(2);
    expect(rows[0]).toHaveAccessibleName(
      "Reduzir o prazo: termina em 242 meses, economia de R$ 247.855,59",
    );
    expect(screen.getByText("R$ 44.285,85")).toBeVisible();
    expect(
      screen.getByText("Saldo depois da amortização R$ 277.104,00"),
    ).toBeVisible();
    const bars = rows.map(
      (row) => row.querySelector("span > span")?.getAttribute("style") ?? "",
    );
    expect(bars[0]).toContain("inline-size: 100%");
    expect(parseFloat(bars[1]?.split("inline-size: ")[1] ?? "")).toBeCloseTo(
      17.8676,
      4,
    );
  });
});

describe("RangeStrip", () => {
  it("positions the band from low to high as a percent of max", () => {
    const { container } = render(
      <RangeStrip
        low={15675236}
        mid={21882263}
        high={30392674}
        fixed={22739502}
        max={32000000}
        label="9 em 10 simulações entre R$ 156.752,36 e R$ 303.926,74"
        legend={["9 em 10 simulações", "Metade acima", "Taxa fixa"]}
        facts={[
          { term: "Desfavorável", value: "R$ 156.752,36" },
          { term: "Favorável", value: "R$ 303.926,74" },
        ]}
      />,
    );

    const band = container.querySelector("span[style*='inset-inline-start']");
    expect(
      parseFloat((band as HTMLElement).style.insetInlineStart),
    ).toBeCloseTo(48.9851, 4);
    expect(parseFloat((band as HTMLElement).style.inlineSize)).toBeCloseTo(
      45.992,
      4,
    );
    expect(screen.getByRole("img")).toHaveAccessibleName(
      "9 em 10 simulações entre R$ 156.752,36 e R$ 303.926,74",
    );
    expect(container.querySelector("p")).toHaveTextContent(
      "9 em 10 simulaçõesMetade acimaTaxa fixa",
    );
    expect(container.querySelectorAll("dl > div")).toHaveLength(2);
    expect(screen.getByText("R$ 303.926,74").tagName).toBe("DD");
  });
});

describe("FactRows", () => {
  it("draws term, optional note and the value in the dd of each row", () => {
    const { container } = render(
      <FactRows
        rows={[
          { term: "Renda", note: "em dinheiro de hoje", value: "R$ 629,54" },
          { term: "Parte para viver", value: "R$ 472,16" },
        ]}
      />,
    );

    const rows = container.querySelectorAll("dl > div");
    expect(rows).toHaveLength(2);
    expect(screen.getByText("Renda").tagName).toBe("DT");
    const note = screen.getByText("em dinheiro de hoje");
    expect(note.closest("dt")).toBe(screen.getByText("Renda").closest("dt"));
    expect(note.parentElement?.tagName).toBe("DT");
    expect(rows[0]?.querySelector("dd")?.textContent).toBe("R$ 629,54");
    expect(screen.getByText("R$ 629,54").tagName).toBe("DD");
    expect(rows[1]?.lastElementChild?.textContent).toBe("R$ 472,16");
    expect(rows[1]?.querySelectorAll("span")).toHaveLength(0);
  });
});
