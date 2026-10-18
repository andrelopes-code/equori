import { useQuery } from "@tanstack/react-query";
import {
  Alert,
  AlertActions,
  AlertContent,
  AlertDescription,
  AlertTitle,
} from "@slotted/react/alert";
import { ButtonLink } from "@slotted/react/button";

import { useApi } from "@/api/api-context";
import { uncategorizedCountQuery } from "@/features/transactions";
import { useT } from "@/i18n/i18n-provider";
import { useSpaLink } from "@/ui/use-spa-link";

const uncategorizedHref = "/transactions?uncategorized=true";

export function UncategorizedShortcut({
  className,
}: {
  className?: string | undefined;
}) {
  const t = useT();
  const spaLink = useSpaLink();
  const { data } = useQuery(uncategorizedCountQuery(useApi()));
  if (data === undefined || data.count === 0) return null;
  const count = data.more ? `${String(data.count)}+` : String(data.count);
  return (
    <Alert tone="accent" reach="section" className={className}>
      <AlertContent>
        <AlertTitle>{t("home.uncategorized", { count })}</AlertTitle>
        <AlertDescription>
          {t("home.uncategorized.description")}
        </AlertDescription>
      </AlertContent>
      <AlertActions>
        <ButtonLink
          {...spaLink(uncategorizedHref)}
          tone="accent"
          variant="outline"
          size="sm"
        >
          {t("home.uncategorized.action")}
        </ButtonLink>
      </AlertActions>
    </Alert>
  );
}
