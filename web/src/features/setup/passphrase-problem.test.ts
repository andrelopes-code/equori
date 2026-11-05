import { describe, expect, it } from "vitest";

import { passphraseProblem } from "@/features/setup/passphrase-problem";

const base = {
  passphrase: "correct horse",
  confirmation: "correct horse",
  proposed: false,
  saved: false,
};

// Export design C1 and T9.
describe("passphraseProblem", () => {
  it("accepts 8 to 256 characters typed twice", () => {
    expect(passphraseProblem(base)).toBeNull();
    expect(
      passphraseProblem({
        ...base,
        passphrase: "12345678",
        confirmation: "12345678",
      }),
    ).toBeNull();
  });

  it("counts characters, not bytes", () => {
    const eight = "ééééééé"; // seven characters of two bytes each
    expect(
      passphraseProblem({ ...base, passphrase: eight, confirmation: eight }),
    ).toBe("tooShort");
  });

  it("refuses fewer than 8 and more than 256 characters", () => {
    expect(passphraseProblem({ ...base, passphrase: "short" })).toBe(
      "tooShort",
    );
    const long = "a".repeat(257);
    expect(
      passphraseProblem({ ...base, passphrase: long, confirmation: long }),
    ).toBe("tooShort");
  });

  it("asks for the second entry of a typed passphrase", () => {
    expect(passphraseProblem({ ...base, confirmation: "correct hors" })).toBe(
      "mismatch",
    );
  });

  it("asks for the saved checkbox of the proposed passphrase and no second entry", () => {
    const proposed = { ...base, proposed: true, confirmation: "" };
    expect(passphraseProblem(proposed)).toBe("unsaved");
    expect(passphraseProblem({ ...proposed, saved: true })).toBeNull();
  });
});
