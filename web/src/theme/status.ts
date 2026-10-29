import { seedStyle } from "@slotted/theme/seeds";
import { useSyncExternalStore } from "react";

import { preference } from "@/theme/preference";
import type { Preference } from "@/theme/preference";

export type StatusName = "success" | "danger" | "warning" | "info";

// "theme" keeps the compiled theme's own seed; any other value is a colour the reader picked.
export type StatusSeed = "theme" | `#${string}`;

export const statusNames: readonly StatusName[] = [
  "success",
  "danger",
  "warning",
  "info",
];

const hexColor = /^#[0-9a-f]{6}$/;

function statusSeed(name: StatusName): Preference<StatusSeed> {
  return preference<StatusSeed>(
    `equori.${name}`,
    (value) => value === "theme" || hexColor.test(value),
    "theme",
    (value) => {
      const root = document.documentElement.style;
      for (const [property, seed] of Object.entries(
        seedStyle({ [name]: value === "theme" ? "#000000" : value }),
      )) {
        if (value === "theme") root.removeProperty(property);
        else root.setProperty(property, seed);
      }
    },
  );
}

// Money in reads the success tone and an overspent figure the danger tone, so these seeds colour them.
export const statusSeeds: Readonly<Record<StatusName, Preference<StatusSeed>>> =
  {
    success: statusSeed("success"),
    danger: statusSeed("danger"),
    warning: statusSeed("warning"),
    info: statusSeed("info"),
  };

export function useStatusSeed(
  name: StatusName,
): [StatusSeed, (value: StatusSeed) => void] {
  const seed = statusSeeds[name];

  return [useSyncExternalStore(seed.subscribe, seed.snapshot), seed.apply];
}
