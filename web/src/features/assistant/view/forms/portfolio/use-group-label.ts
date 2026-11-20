import { useCallback } from "react";

import { catalogKey } from "@/features/assistant/model/catalog-key";
import { useT } from "@/i18n/i18n-provider";

// The name of an allocation group: an instrument type from the catalog, a currency code or an
// institution as the read wrote it.
export function useGroupLabel(): (key: string) => string {
  const t = useT();

  return useCallback(
    (key: string) => {
      const k = catalogKey(`assistantView.group.${key}`);
      return k === undefined ? key : t(k);
    },
    [t],
  );
}
