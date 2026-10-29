import { useQuery } from "@tanstack/react-query";

import { helpPageQuery } from "@/features/help/help-pages";
import { useAppLocaleState } from "@/i18n/i18n-provider";

// The page in the reader's language with the passage of the reader's region.
export function useHelpPage(id: string) {
  const { locale } = useAppLocaleState();

  return useQuery(helpPageQuery(locale.language, locale.region, id));
}
