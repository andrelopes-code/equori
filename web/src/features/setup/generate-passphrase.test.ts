import { describe, expect, it } from "vitest";

import { generatePassphrase } from "@/features/setup/generate-passphrase";

// Export design T9.
describe("generatePassphrase", () => {
  it("indexes the alphabet with the low five bits of each byte", () => {
    // 224 + i has the low five bits of i, so a source that skips the mask reads past the alphabet.
    const bytes = (buffer: Uint8Array) => {
      buffer.forEach((_, i) => {
        buffer[i] = 224 + i;
      });
      return buffer;
    };

    expect(generatePassphrase(bytes)).toBe("ABCDE-FGHJK-LMNPQ-RSTUV-WXYZ2");
  });

  it("draws 25 symbols of the alphabet in five groups of five", () => {
    expect(generatePassphrase()).toMatch(
      /^([A-HJ-NP-Z2-9]{5}-){4}[A-HJ-NP-Z2-9]{5}$/u,
    );
  });

  it("differs between calls", () => {
    expect(generatePassphrase()).not.toBe(generatePassphrase());
  });
});
