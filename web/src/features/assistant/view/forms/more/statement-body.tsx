import { ShareList } from "@/features/assistant/view/forms/more/share-list";
import type { StatementData } from "@/features/assistant/view/forms/more/more-data";
import { useValueFormat } from "@/features/assistant/view/use-value-format";
import { valueText } from "@/features/assistant/view/value-text";
import type { FormBodyProps } from "@/features/assistant/view/view-forms";

// A card statement by category: the composition of its total.
export function StatementBody({ data }: FormBodyProps) {
  const format = useValueFormat();
  const d = data as StatementData;

  const items = d.categories.map((c) => ({
    key: c.category_id,
    name: c.name,
    value: format.money(c.total),
    share: valueText({ bp: c.share_bp }, format),
    weight: c.share_bp,
  }));

  return (
    <ShareList
      label={items.map((i) => `${i.name} ${i.share}`).join(", ")}
      items={items}
    />
  );
}
