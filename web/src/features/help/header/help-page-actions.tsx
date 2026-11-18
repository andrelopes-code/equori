import { ButtonLink } from "@slotted/react/button";
import { Icon } from "@slotted/react/icon";
import { Kbd } from "@slotted/react/kbd";
import { Link, useNavigate } from "@tanstack/react-router";
import { useCallback } from "react";

import { HelpOpenScreen } from "@/features/help/header/help-open-screen";
import { HelpIcon } from "@/features/help/icon/help-icon";
import { useSlashKey } from "@/features/help/search/use-slash-key";
import { useT } from "@/i18n/i18n-provider";

// The legend of the key, the same in every language.
const SLASH = "/";

interface HelpPageActionsProps {
  page: string;
}

// The search stays one key away on every help page; the screen of the task is the primary action.
export function HelpPageActions({ page }: HelpPageActionsProps) {
  const t = useT();
  const navigate = useNavigate();

  const openSearch = useCallback(() => {
    void navigate({ to: "/help", search: { q: "" } });
  }, [navigate]);

  useSlashKey(openSearch);

  return (
    <>
      <ButtonLink
        variant="outline"
        tone="secondary"
        start={
          <Icon size="sm">
            <HelpIcon name="search" />
          </Icon>
        }
        end={
          <Kbd size="sm" aria-hidden="true">
            {SLASH}
          </Kbd>
        }
        aria-keyshortcuts="/"
        render={(props) => <Link {...props} to="/help" search={{ q: "" }} />}
      >
        {t("help.search.label")}
      </ButtonLink>

      <HelpOpenScreen page={page} />
    </>
  );
}
