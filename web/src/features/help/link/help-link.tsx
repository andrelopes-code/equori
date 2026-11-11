import { IconButtonLink } from "@slotted/react/button";
import { Glyph, Icon } from "@slotted/react/icon";
import {
  Tooltip,
  TooltipContent,
  TooltipLayer,
  TooltipTrigger,
} from "@slotted/react/tooltip";
import { Link } from "@tanstack/react-router";

import { useT } from "@/i18n/i18n-provider";
import { useServed } from "@/ui/use-served";

interface HelpLinkProps {
  page: string;
}

// The help button of a screen the curation selected: the question mark every reader knows, named
// by its tooltip, leading to the page that explains the screen (design, Camada 2).
export function HelpLink({ page }: HelpLinkProps) {
  const t = useT();
  const served = useServed();

  if (!served({ to: "/help/$page", params: { page } })) return null;

  return (
    <Tooltip describes="label">
      <TooltipTrigger
        render={(props) => (
          <IconButtonLink
            {...props}
            variant="ghost"
            tone="secondary"
            render={(link) => (
              <Link {...link} to="/help/$page" params={{ page }} />
            )}
          >
            <Icon>
              <Glyph name="circle-question" />
            </Icon>
          </IconButtonLink>
        )}
      />
      <TooltipLayer>
        <TooltipContent>{t("help.screen")}</TooltipContent>
      </TooltipLayer>
    </Tooltip>
  );
}
