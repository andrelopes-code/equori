import type { Choice } from "@/ui/choice-select";

// The default choice, then every ISO 4217 currency the runtime lists, named in the language.
export function currencyChoices(tag: string, defaultLabel: string): Choice[] {
  const names = new Intl.DisplayNames([tag], { type: "currency" });

  return [
    { value: "", label: defaultLabel },
    ...Intl.supportedValuesOf("currency").map((code) => ({
      value: code,
      label: `${code} ${names.of(code) ?? ""}`.trim(),
    })),
  ];
}
