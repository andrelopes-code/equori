import { useNavigate } from "@tanstack/react-router";
import { Button, ButtonLink, IconButton } from "@slotted/react/button";
import { Menu, MenuContent, MenuItem, MenuTrigger } from "@slotted/react/menu";

import { useT } from "@/i18n/i18n-provider";
import { IconGlyph } from "@/ui/icon-glyph";
import { useSpaLink } from "@/ui/use-spa-link";
import { useViewport } from "@/ui/use-viewport";

// A voided transaction keeps only its history; the other actions are rejected by the API.
export function TransactionActions({
  id,
  voided,
  canCategorize,
  onCategorize,
  onVoid,
  onHistory,
}: {
  id: string;
  voided: boolean;
  canCategorize: boolean;
  onCategorize: () => void;
  onVoid: () => void;
  onHistory: () => void;
}) {
  const t = useT();
  const spaLink = useSpaLink();
  const navigate = useNavigate();
  if (useViewport() === "phone") {
    return (
      <Menu>
        <MenuTrigger
          render={(props) => (
            <IconButton
              {...props}
              aria-label={t("transaction.actions.more")}
              tone="secondary"
              variant="ghost"
            >
              <IconGlyph name="more" />
            </IconButton>
          )}
        />
        <MenuContent>
          {!voided && (
            <MenuItem
              onSelect={() => {
                void navigate({
                  to: "/transactions/$id/correct",
                  params: { id },
                });
              }}
            >
              {t("transaction.actions.correct")}
            </MenuItem>
          )}
          {!voided && canCategorize && (
            <MenuItem onSelect={onCategorize}>
              {t("transaction.actions.categorize")}
            </MenuItem>
          )}
          {!voided && (
            <MenuItem tone="danger" onSelect={onVoid}>
              {t("transaction.actions.void")}
            </MenuItem>
          )}
          <MenuItem onSelect={onHistory}>
            {t("transaction.actions.history")}
          </MenuItem>
        </MenuContent>
      </Menu>
    );
  }
  return (
    <>
      {!voided && (
        <ButtonLink
          {...spaLink(`/transactions/${id}/correct`)}
          tone="secondary"
          variant="outline"
        >
          {t("transaction.actions.correct")}
        </ButtonLink>
      )}
      {!voided && canCategorize && (
        <Button tone="secondary" variant="outline" onClick={onCategorize}>
          {t("transaction.actions.categorize")}
        </Button>
      )}
      {!voided && (
        <Button tone="secondary" variant="outline" onClick={onVoid}>
          {t("transaction.actions.void")}
        </Button>
      )}
      <Button tone="secondary" variant="ghost" onClick={onHistory}>
        {t("transaction.actions.history")}
      </Button>
    </>
  );
}
