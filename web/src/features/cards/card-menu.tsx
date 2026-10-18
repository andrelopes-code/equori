import { IconButton } from "@slotted/react/button";
import { Menu, MenuContent, MenuItem, MenuTrigger } from "@slotted/react/menu";

import { useT } from "@/i18n/i18n-provider";
import { IconGlyph } from "@/ui/icon-glyph";
import { useSpaLink } from "@/ui/use-spa-link";

// Complete frontend C2: the card's less frequent actions. The installment purchase needs a
// billing rule (C17).
export function CardMenu({
  accountId,
  installments,
}: {
  accountId: string;
  installments: boolean;
}) {
  const t = useT();
  const spaLink = useSpaLink();
  return (
    <Menu>
      <MenuTrigger
        render={(props) => (
          <IconButton
            {...props}
            aria-label={t("cards.menu")}
            tone="secondary"
            variant="outline"
            size="md"
          >
            <IconGlyph name="more" />
          </IconButton>
        )}
      />
      <MenuContent>
        {installments ? (
          <MenuItem
            render={(props) => (
              <a {...props} {...spaLink(`/cards/${accountId}/purchases/new`)} />
            )}
          >
            {t("cards.action.installment")}
          </MenuItem>
        ) : (
          <MenuItem disabled>{t("cards.action.installment")}</MenuItem>
        )}
        <MenuItem
          render={(props) => (
            <a {...props} {...spaLink(`/cards/${accountId}/settings`)} />
          )}
        >
          {t("cards.action.settings")}
        </MenuItem>
      </MenuContent>
    </Menu>
  );
}
