import {
  ActionBar,
  ActionBarAction,
  ActionBarActions,
} from "@slotted/react/action-bar";
import { Button } from "@slotted/react/button";
import { PageFooter } from "@slotted/react/page";
import { useNavigate } from "@tanstack/react-router";

import { useT } from "@/i18n/i18n-provider";

interface ImportActionsProps {
  id: string;
  ready: boolean;
  busy: boolean;
  onSubmit: () => void;
}

export function ImportActions({
  id,
  ready,
  busy,
  onSubmit,
}: ImportActionsProps) {
  const t = useT();
  const navigate = useNavigate();

  return (
    <PageFooter>
      <ActionBar aria-label={t("importFile.actions")}>
        <ActionBarActions>
          <ActionBarAction>
            <Button
              variant="ghost"
              tone="secondary"
              onClick={() => {
                void navigate({ to: "/accounts/$id", params: { id } });
              }}
            >
              {t("detail.cancel")}
            </Button>
          </ActionBarAction>
          <ActionBarAction>
            <Button disabled={!ready} loading={busy} onClick={onSubmit}>
              {t("importFile.submit")}
            </Button>
          </ActionBarAction>
        </ActionBarActions>
      </ActionBar>
    </PageFooter>
  );
}
