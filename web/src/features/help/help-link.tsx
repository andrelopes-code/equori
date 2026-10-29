import { ButtonLink } from "@slotted/react/button";
import { Link } from "@tanstack/react-router";

import { useT } from "@/i18n/i18n-provider";
import { useServed } from "@/ui/use-served";

interface HelpLinkProps {
  page: string;
}

// The way from a screen the curation selected to the help page that explains it (design,
// Camada 2).
export function HelpLink({ page }: HelpLinkProps) {
  const t = useT();
  const served = useServed();

  if (!served({ to: "/help/$page", params: { page } })) return null;

  return (
    <ButtonLink
      variant="ghost"
      tone="secondary"
      render={(props) => <Link {...props} to="/help/$page" params={{ page }} />}
    >
      {t("help.screen")}
    </ButtonLink>
  );
}
