import { Badge } from "@slotted/react/badge";
import { Link } from "@slotted/react/link";
import { VisuallyHidden } from "@slotted/react/visually-hidden";
import type { MouseEvent } from "react";

import type { components } from "@/api/schema.gen";
import type { MessageKey } from "@/i18n/catalog.en";
import { useT } from "@/i18n/i18n-provider";
import { routeTo } from "@/ui/route-to";
import { useServed } from "@/ui/use-served";

type Categorization = components["schemas"]["Categorization"];
type Method = NonNullable<Categorization["method"]>;

const words: Record<Method, { short: MessageKey; label: MessageKey }> = {
  rule: { short: "method.short.rule", label: "method.mark.rule" },
  source: { short: "method.short.source", label: "method.mark.source" },
  history: { short: "method.short.history", label: "method.mark.history" },
  manual: { short: "method.short.manual", label: "method.mark.manual" },
};

// How a row's categories were decided (A79): a short word on screen, the whole sentence for a
// screen reader. A rule's mark opens the rule.
export function CategorizationMark({
  categorization,
}: {
  categorization: Categorization | undefined;
}) {
  const t = useT();
  const served = useServed();

  const method = categorization?.method;
  if (method === undefined || method === null) return null;
  const { short, label } = words[method];
  const badge = (
    <Badge size="sm" variant="outline" tone="secondary">
      <span aria-hidden="true">{t(short)}</span>
      <VisuallyHidden>{t(label)}</VisuallyHidden>
    </Badge>
  );
  const ruleId = categorization?.rule_id;
  if (method !== "rule" || ruleId === undefined) return badge;

  const rule = { to: "/categories/rules/$id", params: { id: ruleId } } as const;
  if (!served(rule)) return badge;

  return (
    <Link
      variant="neutral"
      underline="none"
      render={routeTo(rule)}
      onClick={(event: MouseEvent<HTMLAnchorElement>) => {
        // The row opens the transaction on a click; the mark opens the rule instead.
        event.stopPropagation();
      }}
    >
      {badge}
    </Link>
  );
}
