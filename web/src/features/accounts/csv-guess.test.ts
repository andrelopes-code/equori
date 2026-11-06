import { describe, expect, it } from "vitest";

import {
  completeProfile,
  draftNeedsMarker,
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
