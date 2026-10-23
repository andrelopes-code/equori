import type { components } from "@/api/schema.gen";
import { cellText } from "@/features/admin/cell-text";
import type { CellContext } from "@/features/admin/cell-text";
// eslint-disable-next-line @typescript-eslint/no-restricted-imports -- writes a percentage, not an amount
import { formatPlain } from "@/i18n/format";

type RuleCondition = components["schemas"]["RuleCondition"];
type RuleAction = components["schemas"]["RuleAction"];
type RuleSplitPart = components["schemas"]["RuleSplitPart"];

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

// A record reads by its name alone; an ID with no known name keeps its first eight characters.
function nameOf(id: string, ctx: CellContext): string {
  return ctx.names.get(id) ?? id.slice(0, 8);
}

function valueText(value: unknown, ctx: CellContext): string {
  if (Array.isArray(value)) {
    return `[${value.map((item) => valueText(item, ctx)).join(", ")}]`;
  }
  if (typeof value === "string") {
    return uuid.test(value) ? nameOf(value, ctx) : JSON.stringify(value);
  }
  return cellText(value, ctx);
}

export function conditionText(
  condition: Readonly<RuleCondition>,
  ctx: CellContext,
): string {
  return `${condition.field} ${condition.operator} ${valueText(condition.value, ctx)}`;
}

// percent is in basis points.
function partText(part: Readonly<RuleSplitPart>, ctx: CellContext): string {
  const share =
    part.percent !== undefined
      ? `${formatPlain(part.percent, 2)}%`
      : part.amount !== undefined
        ? cellText(part.amount, ctx)
        : "remainder";
  return `${nameOf(part.category_id, ctx)} ${share}`;
}

export function actionText(
  action: Readonly<RuleAction>,
  ctx: CellContext,
): string {
  const target =
    action.category_id ?? action.payee_id ?? action.account_id ?? undefined;
  const detail =
    target !== undefined
      ? nameOf(target, ctx)
      : action.tags !== undefined
        ? action.tags.join(", ")
        : action.parts !== undefined
          ? action.parts.map((part) => partText(part, ctx)).join(", ")
          : "";
  return detail === "" ? action.type : `${action.type} ${detail}`;
}
