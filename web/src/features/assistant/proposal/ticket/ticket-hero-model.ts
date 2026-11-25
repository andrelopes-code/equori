import type { components } from "@/api/schema.gen";
import { changeOf } from "@/features/assistant/proposal/preview-field";
import { priced } from "@/features/assistant/proposal/ticket/ticket-money";

type Preview = components["schemas"]["AssistantPreview"];
type Value = components["schemas"]["AssistantValue"];

export type TicketFigure =
  | { kind: "quantity"; value: Value; was?: Value }
  | { kind: "ratio"; from: string; to: string }
  | { kind: "rate"; rate?: string; index?: string; spread?: string }
  | { kind: "code"; value: string };

export interface TicketHeroData {
  figure: TicketFigure;
  code?: string;
  // The security held, when the operation gives another one.
  codeBefore?: string;
  price?: { value: Value; was?: Value };
  // The name of a contract.
  name?: string;
}

// What the operation is, as its first line: units of a security at a price, the ratio of a
// corporate action, the rate of a contract, or the security alone.
export function ticketHero(
  preview: Preview,
  kind: string,
): TicketHeroData | undefined {
  if (kind === "record_fixed_income") return contractHero(preview);

  const instrument = changeOf(preview, "instrument");
  const code = instrument?.after?.text;
  const figure = unitsFigure(preview);

  if (figure === undefined) {
    return code === undefined
      ? undefined
      : { figure: { kind: "code", value: code } };
  }

  const codeBefore = instrument?.before?.text;
  const price = kind === "bonus" ? undefined : heroPrice(preview);

  return {
    figure,
    ...(code !== undefined && { code }),
    ...(codeBefore !== undefined && { codeBefore }),
    ...(price !== undefined && { price }),
  };
}

function contractHero(preview: Preview): TicketHeroData {
  const rate = changeOf(preview, "rate")?.after?.text;
  const index = changeOf(preview, "index")?.after?.text;
  const spread = changeOf(preview, "spread")?.after?.text;
  const known = rate ?? index ?? spread;

  // More money into a contract the book holds: the target is its code.
  if (known === undefined) {
    return { figure: { kind: "code", value: preview.target ?? "" } };
  }

  return {
    figure: {
      kind: "rate",
      ...(rate !== undefined && { rate }),
      ...(index !== undefined && { index }),
      ...(spread !== undefined && { spread }),
    },
    ...(preview.target !== undefined && { name: preview.target }),
  };
}

function unitsFigure(preview: Preview): TicketFigure | undefined {
  const quantity = changeOf(preview, "quantity");
  if (quantity?.after !== undefined) {
    return {
      kind: "quantity",
      value: quantity.after,
      ...(quantity.before !== undefined && { was: quantity.before }),
    };
  }

  const [from, to] =
    changeOf(preview, "ratio")?.after?.text?.split(" : ") ?? [];

  return from === undefined || to === undefined
    ? undefined
    : { kind: "ratio", from, to };
}

function heroPrice(preview: Preview): TicketHeroData["price"] {
  const price = changeOf(preview, "price");
  const amount = changeOf(preview, "amount")?.after;
  const value = priced(price?.after, amount);
  if (value === undefined) return undefined;

  const was = priced(price?.before, amount);

  return { value, ...(was !== undefined && { was }) };
}
