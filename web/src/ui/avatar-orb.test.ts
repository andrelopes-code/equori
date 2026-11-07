import { describe, expect, it } from "vitest";

import { avatarOrb } from "@/ui/avatar-orb";

describe("avatarOrb", () => {
  it("gives the same orb to the same seed", () => {
    expect(avatarOrb("ana@equori.local")).toEqual(
      avatarOrb("ana@equori.local"),
    );
  });

  it("gives different seeds different orbs", () => {
    const seeds = [
      "ana@a.co",
      "bia@a.co",
      "caio@a.co",
      "duda@a.co",
      "edu@a.co",
    ];
    const orbs = new Set(seeds.map((s) => JSON.stringify(avatarOrb(s))));

    expect(orbs.size).toBe(seeds.length);
  });

  it("keeps the angle in a turn and draws no colour of its own", () => {
    for (const seed of ["a", "ana@equori.local", "Conta Demonstrativa", ""]) {
      const orb = avatarOrb(seed);

      expect(Object.keys(orb)).toEqual(["angle"]);
      expect(orb.angle).toBeGreaterThanOrEqual(0);
      expect(orb.angle).toBeLessThan(360);
    }
  });
});
