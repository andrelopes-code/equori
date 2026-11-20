import { catalogKey } from "@/features/assistant/model/catalog-key";
import { ShareList } from "@/features/assistant/view/forms/more/share-list";
import type { CategorizationData } from "@/features/assistant/view/forms/more/more-data";
import { useValueFormat } from "@/features/assistant/view/use-value-format";
import { valueText } from "@/features/assistant/view/value-text";
import type { FormBodyProps } from "@/features/assistant/view/view-forms";
import { useT } from "@/i18n/i18n-provider";

// How the period's transactions got their category: rule, bank, history, by hand, or waiting.
export function CategorizationBody({ data }: FormBodyProps) {
  const t = useT();
  const format = useValueFormat();
  const d = data as CategorizationData;

  const name = (m: string) => {
    const key = catalogKey(`assistantView.method.${m}`);
    return key === undefined ? m : t(key);
  };
  const items = d.methods.map((m) => ({
    key: m.method,
    name: name(m.method),
    value: valueText({ count: m.count }, format),
    share: valueText({ bp: m.share_bp }, format),
    weight: m.share_bp,
  }));

  return (
    <ShareList
      label={items.map((i) => `${i.name} ${i.share}`).join(", ")}
      items={items}
    />
  );
}
