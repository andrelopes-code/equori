import type { MessageKey } from "@/i18n/catalog.en";

type Translate = (key: MessageKey) => string;

// The name of a region in the language of tag. "EU" names the euro area, whose feeds and calendars
// are not those of the European Union as a whole.
export function regionName(region: string, t: Translate, tag: string): string {
  if (region === "global") return t("region.global");
  if (region === "EU") return t("region.euroArea");

  return new Intl.DisplayNames([tag], { type: "region" }).of(region) ?? region;
}
