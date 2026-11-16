import type { Choice } from "@/ui/form-fields/choice-select";
import { currencyRegion } from "@/ui/region/currency-region";

interface CurrencyInstrument {
  code: string;
  name: string;
}

interface Headings {
  inUse: string;
  all: string;
}

// The choices of the base currency: each reads "BRL Real brasileiro" in the language of tag with
// the flag of its country. The currency in use leads under its own heading and the rest follow by
// name.
export function currencyChoices(
  instruments: readonly CurrencyInstrument[],
  tag: string,
  current: string | null,
  headings: Headings,
): Choice[] {
  const names = new Intl.DisplayNames([tag], { type: "currency" });
  const choices = instruments.map((i) => {
    const name = nameOf(i, names);
    const flag = currencyRegion(i.code);

    return {
      name,
      choice: {
        value: i.code,
        label: `${i.code} ${name}`,
        group: i.code === current ? headings.inUse : headings.all,
        ...(flag === null ? {} : { flag }),
      },
    };
  });
  const inUse = choices.filter((c) => c.choice.value === current);
  const rest = choices
    .filter((c) => c.choice.value !== current)
    .sort((a, b) => a.name.localeCompare(b.name, tag));

  return [...inUse, ...rest].map((c) => c.choice);
}

function nameOf(i: CurrencyInstrument, names: Intl.DisplayNames): string {
  const name = names.of(i.code);
  if (name === undefined || name === i.code) return i.name;

  return name.charAt(0).toLocaleUpperCase() + name.slice(1);
}
