import {
  DescriptionList,
  DescriptionListDescription,
  DescriptionListItem,
  DescriptionListTerm,
} from "@slotted/react/description-list";

import type { components } from "@/api/schema.gen";
import { useDisplay } from "@/features/admin/use-display";
import type { MessageKey } from "@/i18n/catalog.en";
import { useT } from "@/i18n/i18n-provider";

type Statement = components["schemas"]["StatementSummary"];

// The summary's own arithmetic, in its order: opening + charges − credits = amount due;
// amount due − payments = unpaid.
const lines: readonly [
  MessageKey,
  "opening" | "charges" | "credits" | "amount_due" | "payments" | "unpaid",
][] = [
  ["admin.headline.opening", "opening"],
  ["admin.headline.charges", "charges"],
  ["admin.headline.credits", "credits"],
  ["admin.headline.amountDue", "amount_due"],
  ["admin.headline.payments", "payments"],
  ["admin.headline.balance", "unpaid"],
];

export function StatementBreakdown({ statement }: { statement: Statement }) {
  const t = useT();
  const show = useDisplay();
  return (
    <DescriptionList variant="ruled">
      {lines.map(([label, figure]) => (
        <DescriptionListItem key={figure}>
          <DescriptionListTerm>{t(label)}</DescriptionListTerm>
          <DescriptionListDescription>
            {show.money(statement[figure])}
          </DescriptionListDescription>
        </DescriptionListItem>
      ))}
    </DescriptionList>
  );
}
