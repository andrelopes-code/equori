import { useReturnOptions } from "@/features/portfolio/return/use-return-options";
import { useResultsSearch } from "@/features/portfolio/results/use-results-search";
import { useT } from "@/i18n/i18n-provider";
import { ChoiceSelect } from "@/ui/form-fields/choice-select";

// PR2: the brokerage tree the results read; the whole portfolio while the key is absent.
export function ResultsAccountSelect() {
  const t = useT();
  const { options } = useReturnOptions();
  const [search, patch] = useResultsSearch();

  const selected =
    options.find((o) => o.value === search.account)?.value ??
    options[0]?.value ??
    null;

  function handleChange(next: string | string[] | null) {
    if (typeof next !== "string") return;

    patch({ account: next === options[0]?.value ? undefined : next });
  }

  return (
    <ChoiceSelect
      label={t("portfolio.results.account")}
      choices={options}
      multiple={false}
      value={selected}
      onChange={handleChange}
    />
  );
}
