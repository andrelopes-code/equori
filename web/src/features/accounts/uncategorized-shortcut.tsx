import { useQuery } from "@tanstack/react-query";
import { ButtonLink } from "@slotted/react/button";

import { useApi } from "@/api/api-context";
import { uncategorizedCountQuery } from "@/features/transactions";
import { useT } from "@/i18n/i18n-provider";
import { useSpaLink } from "@/ui/use-spa-link";

const uncategorizedHref = "/transactions?uncategorized=true";

export function UncategorizedShortcut() {
  const t = useT();
  const spaLink = useSpaLink();
  const { data } = useQuery(uncategorizedCountQuery(useApi()));
  if (data === undefined || data.count === 0) return null;
  const count = data.more ? `${String(data.count)}+` : String(data.count);
  return (
    <div>
      <ButtonLink
        {...spaLink(uncategorizedHref)}
        tone="secondary"
        variant="outline"
      >
        {t("home.uncategorized", { count })}
      </ButtonLink>
    </div>
  );
}
