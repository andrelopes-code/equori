import { IconButton } from "@slotted/react/button";
import { Glyph, Icon } from "@slotted/react/icon";
import { Menu, MenuContent, MenuItem, MenuTrigger } from "@slotted/react/menu";
import { useNavigate } from "@tanstack/react-router";

import { useT } from "@/i18n/i18n-provider";

export function PayeeActions({
  payee,
  onManageAliases,
}: {
  payee: { id: string; name: string };
  onManageAliases: () => void;
}) {
  const t = useT();
  const navigate = useNavigate();
  return (
    <Menu>
      <MenuTrigger
        render={(props) => (
          <IconButton
            {...props}
            size="sm"
            variant="ghost"
            tone="secondary"
            aria-label={t("payees.actions", { name: payee.name })}
          >
            <Icon>
              <Glyph name="ellipsis" />
            </Icon>
          </IconButton>
        )}
      />
      <MenuContent>
        <MenuItem
          onSelect={() => {
            void navigate({
              to: "/transactions",
              search: { payee_id: payee.id },
            });
          }}
        >
          {t("category.viewTransactions")}
        </MenuItem>
        <MenuItem onSelect={onManageAliases}>
          {t("payees.manageAliases")}
        </MenuItem>
      </MenuContent>
    </Menu>
  );
}
