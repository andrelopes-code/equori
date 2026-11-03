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

  it("pairs two neighbouring data slots and keeps the angle in a turn", () => {
    const wheel = [1, 5, 3, 6, 2, 8, 4, 7];

    for (const seed of ["a", "ana@equori.local", "Conta Demonstrativa", ""]) {
      const { slots, angle } = avatarOrb(seed);
      const at = wheel.indexOf(slots[0]);

      expect(slots[1]).toBe(wheel[(at + 1) % wheel.length]);
      expect(angle).toBeGreaterThanOrEqual(0);
      expect(angle).toBeLessThan(360);
    }
  });

  it("uses every slot as a first colour across many seeds", () => {
    const firsts = new Set(
      Array.from(
        { length: 200 },
        (_, i) => avatarOrb(`person-${String(i)}`).slots[0],
      ),
    );

    expect(firsts.size).toBe(8);
  });
});
