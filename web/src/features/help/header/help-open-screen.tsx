import { ButtonLink } from "@slotted/react/button";
import { Icon } from "@slotted/react/icon";
import { Link } from "@tanstack/react-router";
import type { NavigateOptions } from "@tanstack/react-router";

import { HelpIcon } from "@/features/help/icon/help-icon";
import { helpGuides } from "@/features/help/model/help-guides";
import { useT } from "@/i18n/i18n-provider";
import { useServed } from "@/ui/navigation/use-served";

interface HelpOpenScreenProps {
  page: string;
  // The header holds the page's one solid action; under the lead of a phone it is outlined.
  variant?: "solid" | "outline";
}

// The way from a page to the screen it describes (help spec, HP7); drawn when the page has a
// screen and the screen is served at this width.
export function HelpOpenScreen({
  page,
  variant = "solid",
}: HelpOpenScreenProps) {
  const t = useT();
  const served = useServed();

  const guide = helpGuides[page];
  if (guide?.screen === undefined || guide.area === undefined) return null;

  // The catalog holds routes of the router only.
  const to = guide.screen as NonNullable<NavigateOptions["to"]>;
  if (!served({ to })) return null;

  return (
    <ButtonLink
      variant={variant}
      tone={variant === "solid" ? "accent" : "secondary"}
      end={
        <Icon size="sm">
          <HelpIcon name="open" />
        </Icon>
      }
      render={(props) => <Link {...props} to={to} />}
    >
      {t("help.open", { screen: t(`help.area.${guide.area}`) })}
    </ButtonLink>
  );
}
