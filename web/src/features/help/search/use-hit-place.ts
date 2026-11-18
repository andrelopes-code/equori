import type { HelpHit } from "@/features/help/search/search-help";
import { useT } from "@/i18n/i18n-provider";

// Where a result stands: the kind of its page, the page of its section, or the glossary.
export function useHitPlace(): (hit: HelpHit) => string {
  const t = useT();

  return (hit) => {
    if (hit.group === "sections") {
      return t("help.search.in", { page: hit.pageTitle });
    }

    if (hit.group === "terms") return t("help.glossary.title");

    return t(`help.kind.${hit.kind}`);
  };
}
