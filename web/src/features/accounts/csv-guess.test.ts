import { describe, expect, it } from "vitest";

import {
  applySuggestion,
  completeProfile,
  csvSample,
  dateLayoutChoices,
  draftNeedsMarker,
  guessProfile,
  readyProfile,
  sameProfile,
} from "@/features/accounts/csv-guess";
import type { ProfileDraft } from "@/features/accounts/csv-guess";
import type { components } from "@/api/schema.gen";

type CsvProfile = components["schemas"]["CsvProfile"];

const draft: ProfileDraft = {
  delimiter: "semicolon",
  header_rows: 1,
  date_column: "Data",
  date_layout: "DD/MM/YYYY",
  amount_column: "Valor",
  decimal_separator: ",",
  description_column: "Descrição",
  amount_sign: "as_is",
};

describe("completeProfile", () => {
  it("keeps the reading fields the draft holds", () => {
    const held = {
      ...draft,
      encoding: "windows-1252",
      group_separator: "",
      footer_rows: 0,
      sign_column: "Tipo",
      debit_marker: "D",
    };
    expect(completeProfile(held)).toEqual(held);
  });

  it("adds no reading field the draft lacks", () => {
    expect(completeProfile(draft)).toEqual(draft);
  });
});

describe("completeProfile with a sign column", () => {
  it("is incomplete until the debit marker is chosen", () => {
    expect(completeProfile({ ...draft, sign_column: "Tipo" })).toBeNull();
    expect(
      completeProfile({ ...draft, sign_column: "Tipo", debit_marker: "D" }),
    ).not.toBeNull();
  });
});

describe("draftNeedsMarker", () => {
  const text = (amount: string) =>
    `Data;Descrição;Valor\n05/10/2026;x;${amount}\n`;

  it("holds for an amount column with a trailing mark", () => {
    expect(draftNeedsMarker(text("100,00 D"), draft)).toBe(true);
  });

  it("fails for an amount with no mark", () => {
    expect(draftNeedsMarker(text("100,00"), draft)).toBe(false);
  });

  it("fails once the debit marker is set", () => {
    expect(
      draftNeedsMarker(text("100,00 D"), { ...draft, debit_marker: "D" }),
    ).toBe(false);
  });
});

describe("sameProfile", () => {
  const profile: CsvProfile = {
    delimiter: "semicolon",
    header_rows: 1,
    date_column: "Data",
    date_layout: "DD/MM/YYYY",
    amount_column: "Valor",
    decimal_separator: ",",
    description_column: "Descrição",
    amount_sign: "as_is",
    encoding: "auto",
  };

  it("ignores the order of the keys", () => {
    const reversed = Object.fromEntries(
      Object.entries(profile).reverse(),
    ) as CsvProfile;
    expect(sameProfile(reversed, profile)).toBe(true);
  });

  it("tells a different value", () => {
    expect(sameProfile({ ...profile, date_column: "Dia" }, profile)).toBe(
      false,
    );
  });

  it("tells a missing profile", () => {
    expect(sameProfile(undefined, profile)).toBe(false);
  });
});

describe("guessProfile", () => {
  const cases: {
    name: string;
    file: string;
    has: ProfileDraft;
    lacks: string[];
  }[] = [
    {
      name: "reads a header file from the words and the shape",
      file: "Data;Descrição;Valor\n05/10/2026;Padaria;-12,50\n16/10/2026;Salário;5.000,00\n",
      has: {
        delimiter: "semicolon",
        header_rows: 1,
        date_column: "Data",
        date_layout: "DD/MM/YYYY",
        description_column: "Descrição",
        amount_column: "Valor",
        decimal_separator: ",",
      },
      lacks: ["group_separator", "footer_rows"],
    },
    {
      name: "leaves the date layout empty when two orders read every row",
      file: "Data;Descrição;Valor\n05/10/2026;Padaria;-12,50\n06/10/2026;Salário;5,00\n",
      has: {
        delimiter: "semicolon",
        header_rows: 1,
        date_column: "Data",
        description_column: "Descrição",
        amount_column: "Valor",
        decimal_separator: ",",
      },
      lacks: ["date_layout", "group_separator", "footer_rows"],
    },
    {
      name: "counts the lines above the header and the footer",
      file: "Banco X\n\nData;Histórico;Valor\n16/10/2026;x;1,00\nTotal;;1,00\n",
      has: { header_rows: 2, footer_rows: 1, date_column: "Data" },
      lacks: [],
    },
    {
      name: "takes the roles of a foreign header from the shape alone",
      file: "Datum;Text;Betrag\n16.10.2026;Miete;-500,00\n17.10.2026;Gehalt;1.000,00\n",
      has: {
        date_column: "Datum",
        date_layout: "DD.MM.YYYY",
        description_column: "Text",
        amount_column: "Betrag",
        decimal_separator: ",",
      },
      lacks: ["group_separator"],
    },
    {
      name: "leaves the amount empty when two columns are numeric",
      file: "Datum;Text;Betrag;Saldo\n16.10.2026;Miete;-500,00;1,00\n",
      has: { date_column: "Datum", description_column: "Text" },
      lacks: ["amount_column"],
    },
    {
      name: "takes debit and credit from the words",
      file: "Data;Histórico;Débito;Crédito\n16/10/2026;x;1,00;\n",
      has: { debit_column: "Débito", credit_column: "Crédito" },
      lacks: ["amount_column"],
    },
    {
      name: "sets the group separator that is not the default",
      file: "Data;Histórico;Valor\n16/10/2026;x;1 234,56\n",
      has: { decimal_separator: ",", group_separator: " " },
      lacks: [],
    },
  ];

  it.each(cases)("$name", ({ file, has, lacks }) => {
    const guess = guessProfile(file);

    expect(guess).toMatchObject(has);
    for (const key of lacks) expect(guess).not.toHaveProperty(key);
  });
});

describe("readyProfile", () => {
  const marked = "Data;Descrição;Valor\n05/10/2026;x;100,00 D\n";

  it("returns the profile of a complete draft", () => {
    expect(readyProfile(marked, { ...draft, debit_marker: "D" })).toEqual({
      ...draft,
      debit_marker: "D",
    });
  });

  it("returns null while the draft needs a marker", () => {
    expect(readyProfile(marked, draft)).toBeNull();
  });

  it("returns null for an incomplete draft", () => {
    expect(readyProfile(marked, { ...draft, date_column: "" })).toBeNull();
  });
});

describe("dateLayoutChoices", () => {
  const text = (...dates: string[]) =>
    `Data;Descrição;Valor\n${dates.map((d) => `${d};x;1,00`).join("\n")}\n`;

  it("puts the layouts of the column before the standard ones", () => {
    expect(dateLayoutChoices(text("5.10.26", "16.10.26"), draft)).toEqual([
      "DD.MM.YY",
      "DD/MM/YYYY",
      "YYYY-MM-DD",
      "MM/DD/YYYY",
    ]);
  });

  it("repeats no layout and keeps the current value", () => {
    expect(
      dateLayoutChoices(text("05/10/2026", "06/10/2026"), {
        ...draft,
        date_layout: "DD-MM-YYYY",
      }),
    ).toEqual(["DD/MM/YYYY", "MM/DD/YYYY", "YYYY-MM-DD", "DD-MM-YYYY"]);
  });
});

describe("csvSample", () => {
  const rows = Array.from(
    { length: 20 },
    (_, i) =>
      `2026-10-${String(i + 1).padStart(2, "0")};row ${String(i)};${String(i)}`,
  );
  const text = [
    "Statement of october",
    "Date;Text;Amount",
    ...rows,
    "Total;;1",
  ].join("\n");
  const base: ProfileDraft = {
    delimiter: "semicolon",
    header_rows: 2,
    footer_rows: 1,
  };

  it("returns the header and the first 12 data rows", () => {
    const sample = csvSample(text, base);

    expect(sample.header).toEqual(["Date", "Text", "Amount"]);
    expect(sample.rows).toHaveLength(12);
    expect(sample.rows[0]).toEqual(["2026-10-01", "row 0", "0"]);
    expect(JSON.stringify(sample)).not.toContain("Statement");
    expect(JSON.stringify(sample)).not.toContain("Total");
  });

  it("has no header with header_rows 0", () => {
    const sample = csvSample(rows.join("\n"), {
      delimiter: "semicolon",
      header_rows: 0,
    });

    expect(sample.header).toBeUndefined();
    expect(sample.rows[0]).toEqual(["2026-10-01", "row 0", "0"]);
  });

  it("cuts a cell to 200 characters and a row to 40 cells", () => {
    const wide = `h\n${"x".repeat(300)}${";c".repeat(49)}`;
    const sample = csvSample(wide, { delimiter: "semicolon", header_rows: 1 });

    expect(sample.rows[0]).toHaveLength(40);
    expect(sample.rows[0]?.[0]).toHaveLength(200);
  });
});

describe("applySuggestion", () => {
  const text = "Datum;Text;Betrag;Saldo\n16.10.2026;Miete;-500,00;1,00\n";
  const start: ProfileDraft = { delimiter: "semicolon" };
  const named = {
    date_column: "Datum",
    description_column: "Text",
    amount_column: "Betrag",
  };

  it("writes the columns and derives the layout and the separator", () => {
    expect(applySuggestion(text, start, named)).toEqual({
      delimiter: "semicolon",
      ...named,
      date_layout: "DD.MM.YYYY",
      decimal_separator: ",",
    });
  });

  it("clears the amount column for a debit and credit pair, and the reverse", () => {
    const pair = applySuggestion(
      text,
      { ...start, amount_column: "Betrag" },
      {
        date_column: "Datum",
        description_column: "Text",
        debit_column: "Betrag",
        credit_column: "Saldo",
      },
    );
    expect(pair.amount_column).toBeUndefined();
    expect(pair.debit_column).toBe("Betrag");

    const single = applySuggestion(
      text,
      { ...start, debit_column: "Betrag", credit_column: "Saldo" },
      named,
    );
    expect(single.debit_column).toBeUndefined();
    expect(single.credit_column).toBeUndefined();
  });

  it("leaves the date layout unset when the dates settle none", () => {
    const loose = "Datum;Text;Betrag\n05.10.2026;a;1,00\n06.10.2026;b;2,00\n";

    expect(applySuggestion(loose, start, named).date_layout).toBeUndefined();
  });

  it("clears the debit marker when the sign column changes", () => {
    const next = applySuggestion(
      text,
      { ...start, sign_column: "Saldo", debit_marker: "D" },
      { ...named, sign_column: "Text" },
    );

    expect(next.sign_column).toBe("Text");
    expect(next.debit_marker).toBeUndefined();
  });
});
