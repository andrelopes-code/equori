import type {
  Security,
  SecurityForm,
} from "@/features/calculators/indexer-comparison/security";
import { quotedForm } from "@/features/calculators/rate-source/index-catalog";

// One row of inputs; `choice` null is the default row: the first index in its quoted form.
export interface DraftSecurity {
  key: number;
  choice: string | null;
  // The rate as typed, in percent.
  rate: string;
  taxed: boolean;
}

export interface IndexChoice {
  form: "percent" | "spread";
  index: string;
}

interface OfferedIndex {
  id: string;
  period: "day" | "month";
}

// IC1: a percent needs a daily index; a spread takes a daily or a monthly one.
export function indexChoices(indexes: readonly OfferedIndex[]): IndexChoice[] {
  return indexes.flatMap((i) =>
    i.period === "day"
      ? [
          { form: "percent" as const, index: i.id },
          { form: "spread" as const, index: i.id },
        ]
      : [{ form: "spread" as const, index: i.id }],
  );
}

export function choiceValue(choice: IndexChoice): string {
  return `${choice.form}:${choice.index}`;
}

export function securityChoice(security: Security): string {
  return security.form === "fixed" || security.index === undefined
    ? "fixed"
    : choiceValue({ form: security.form, index: security.index });
}

export function resolveSecurity(
  row: DraftSecurity,
  offered: readonly OfferedIndex[],
): Security {
  const choice = row.choice ?? defaultChoice(offered);
  const [form, index] = choice.split(":") as [SecurityForm, string | undefined];
  const rate = readPercent(row.rate);

  if (form === "fixed" || index === undefined)
    return { form: "fixed", rate, taxed: row.taxed };

  return { form, index, rate, taxed: row.taxed };
}

function defaultChoice(offered: readonly OfferedIndex[]): string {
  const first = offered[0];

  return first === undefined ? "fixed" : `${quotedForm(first.id)}:${first.id}`;
}

// 8 becomes 0.08 and 140 becomes 1.4; null for an empty text or one that is not a number.
function readPercent(text: string): number | null {
  const value = Number(text.trim().replace(",", "."));

  return text.trim() === "" || Number.isNaN(value) ? null : value / 100;
}
