import type { MessageKey } from "@/i18n/catalog.en";

// The words a region gives this cost (CONTRIBUTING.md, Regions): the name its law gives it, said
// after the method's steps, and the label of the nominal annual rate its contracts state instead,
// shown beside the effective cost.
export function regionalTerms(region: string): {
  note: MessageKey | null;
  nominal: MessageKey | null;
} {
  switch (region) {
    case "BR":
      return { note: "calc.credit.cet", nominal: null };
    // A contract states the APR: the monthly rate times 12 (Regulation Z, 12 CFR 1026.22 and
    // appendix J).
    case "US":
      return { note: "calc.credit.us.aprNote", nominal: "calc.credit.us.apr" };
    default:
      return { note: null, nominal: null };
  }
}
