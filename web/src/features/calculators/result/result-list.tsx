import {
  DescriptionList,
  DescriptionListDescription,
  DescriptionListItem,
  DescriptionListTerm,
} from "@slotted/react/description-list";

import { useT } from "@/i18n/i18n-provider";

export interface Result {
  label: string;
  value: string;
}

// The figures a calculator returns beside its lead, each under the words that name it. No tone:
// a result is not judged (design §2).
export function ResultList({
  results,
  label,
}: {
  results: readonly Result[];
  label?: string;
}) {
  const t = useT();
  return (
    <DescriptionList
      layout="stack"
      columns={2}
      variant="ruled"
      aria-label={label ?? t("calc.results")}
    >
      {results.map((r) => (
        <DescriptionListItem key={r.label}>
          <DescriptionListTerm>{r.label}</DescriptionListTerm>
          <DescriptionListDescription>{r.value}</DescriptionListDescription>
        </DescriptionListItem>
      ))}
    </DescriptionList>
  );
}
