import { describe, expect, it } from "vitest";

import { completeProfile, sameProfile } from "@/features/accounts/csv-guess";
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
