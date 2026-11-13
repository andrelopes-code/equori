import { describe, expect, it } from "vitest";

import {
  groupStatus,
  statusText,
} from "@/features/portfolio/contribution-plan/model/group-status";
import { catalogPtBR } from "@/i18n/catalog.pt-BR";
import type { TFunction } from "@/i18n/i18n-provider";

const t = ((key, vars) =>
  catalogPtBR[key].replace(/\{(\w+)\}/g, (_, name: string) =>
    String(vars?.[name]),
  )) satisfies TFunction;

describe("groupStatus", () => {
  it.each([
    { today: 0, ideal: 4000, want: "below" },
    { today: 7400, ideal: 2000, want: "above" },
    { today: 3951, ideal: 4000, want: "at" },
    { today: 4049, ideal: 4000, want: "at" },
    { today: 3950, ideal: 4000, want: "below" },
    { today: 4050, ideal: 4000, want: "above" },
    { today: 10000, ideal: undefined, want: "noIdeal" },
  ])("reads $today against $ideal as $want", ({ today, ideal, want }) => {
    expect(groupStatus(today, ideal)).toBe(want);
  });
});

describe("statusText", () => {
  it.each([
    {
      today: 0,
      ideal: 4000,
      member: false,
      want: "abaixo do ideal (hoje 0%, ideal 40%)",
    },
    {
      today: 7400,
      ideal: 2000,
      member: false,
      want: "acima do ideal (hoje 74%, ideal 20%)",
    },
    { today: 4010, ideal: 4000, member: false, want: "no ideal (40%)" },
    {
      today: 10000,
      ideal: 5000,
      member: true,
      want: "acima do ideal (hoje 100%, ideal 50% do grupo)",
    },
    {
      today: 0,
      ideal: 5000,
      member: true,
      want: "abaixo do ideal (hoje 0%, ideal 50% do grupo)",
    },
    { today: 5000, ideal: 5000, member: true, want: "no ideal (50% do grupo)" },
    {
      today: 10000,
      ideal: undefined,
      member: true,
      want: "sem ideal próprio (hoje 100% do grupo)",
    },
    {
      today: 740,
      ideal: 2000,
      member: false,
      want: "abaixo do ideal (hoje 7,4%, ideal 20%)",
    },
  ])("writes $today of $ideal as $want", ({ today, ideal, member, want }) => {
    expect(statusText({ today, ideal, member, t, tag: "pt-BR" })).toBe(want);
  });
});
