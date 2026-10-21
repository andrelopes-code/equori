export interface RulePrefill {
  payee?: string;
  description?: string;
  category?: string;
  name?: string;
}

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function text(value: unknown, max: number): string | undefined {
  return typeof value === "string" && value.trim() !== "" && value.length <= max
    ? value
    : undefined;
}

// "Create rule" from a categorized transaction opens the editor on its payee or description.
export function validateRulePrefill(raw: Record<string, unknown>): RulePrefill {
  const payee =
    typeof raw.payee === "string" && uuid.test(raw.payee)
      ? raw.payee
      : undefined;
  const category =
    typeof raw.category === "string" && uuid.test(raw.category)
      ? raw.category
      : undefined;
  const description = text(raw.description, 200);
  const name = text(raw.name, 120);
  return {
    ...(payee === undefined ? {} : { payee }),
    ...(category === undefined ? {} : { category }),
    ...(description === undefined ? {} : { description }),
    ...(name === undefined ? {} : { name }),
  };
}
