import { catalogKey } from "@/features/assistant/model/catalog-key";
import type { MessageKey } from "@/i18n/catalog.en";

// Where the words of a code live, for each field the tools write as one. The first prefix whose
// catalogue holds the code names it.
const PREFIXES = new Map<string, readonly string[]>(
  Object.entries({
    status: ["assistant.value."],
    counts_in: ["assistant.value."],
    class: ["assistant.value.class."],
    category_class: ["assistant.value.class."],
    kind: [
      "kind.title.",
      "assistant.value.kind.",
      "instruments.type.",
      "alias.match.",
      "connection.investments.proposal.",
    ],
    subtype: ["instruments.subtype."],
    role: ["members.role."],
    decision: ["links.decision."],
    source: ["plan.source."],
    color: ["assistant.value.color."],
    icon: ["assistant.value.icon."],
    identifier: ["assistant.value.identifier."],
    scheme: ["scheme."],
    density: ["density."],
    motion: ["assistant.value.motion."],
    corners: ["corners."],
    typeface: ["typeface."],
    amount_tone: ["studio.amountTone."],
    summary_amounts: ["studio.summaryAmounts."],
    visual: ["assistant.value.visual."],
    accent: ["accent."],
  }),
);

// The catalogue key of a code a change carries ("open difference" reads as open_difference);
// undefined for a text the reader wrote or a code the client does not know.
export function changeCodeKey(
  field: string,
  text: string,
): MessageKey | undefined {
  const code = text.trim().toLowerCase();
  const words = code.replace(/[^a-z0-9]+/g, "_");

  for (const prefix of PREFIXES.get(field) ?? []) {
    const key = catalogKey(prefix + code) ?? catalogKey(prefix + words);

    if (key !== undefined) return key;
  }

  return undefined;
}
