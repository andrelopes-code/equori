import { IconButton } from "@slotted/react/button";
import { Glyph, Icon } from "@slotted/react/icon";
import {
  Menu,
  MenuContent,
  MenuItem,
  MenuSeparator,
  MenuTrigger,
} from "@slotted/react/menu";
import { useNavigate } from "@tanstack/react-router";

import type { components } from "@/api/schema.gen";
import { useT } from "@/i18n/i18n-provider";
import { useServed } from "@/ui/navigation/use-served";

type Account = components["schemas"]["Account"];

interface CardMenuProps {
  account: Account;
  closed: boolean;
  compact: boolean;
  onInstallments: () => void;
  onClose: () => void;
  onReopen: () => void;
}

// The other actions of the card, behind the header's ellipsis.
export function CardMenu({
  account,
  closed,
  compact,
  onInstallments,
  onClose,
  onReopen,
}: CardMenuProps) {
  const t = useT();
  const navigate = useNavigate();
  const served = useServed();

  const accountEdit = {
    to: "/accounts/$id/edit",
    params: { id: account.id },
  } as const;

  return (
    <Menu>
      <MenuTrigger
        render={(props) => (
          <IconButton
            {...props}
            variant="ghost"
            tone="secondary"
            aria-label={t("account.more")}
          >
            <Icon>
              <Glyph name="ellipsis" />
            </Icon>
          </IconButton>
        )}
      />
      <MenuContent>
        {compact && !closed && (
          <MenuItem onSelect={onInstallments}>
            {t("card.installmentPurchase")}
          </MenuItem>
        )}
        {!closed && (
          <MenuItem
            onSelect={() => {
              void navigate({
                to: "/transactions/new",
                search: {
                  account_id: account.id,
                  kind: "foreign_purchase",
                },
              });
            }}
          >
            {t("foreignPurchase.record")}
          </MenuItem>
        )}
        {served(accountEdit) && (
          <MenuItem
            onSelect={() => {
              void navigate(accountEdit);
            }}
          >
            {t("account.edit")}
          </MenuItem>
        )}
        <MenuItem
          onSelect={() => {
            void navigate({
              to: "/transactions",
              search: { account_id: account.id },
            });
          }}
        >
          {t("account.viewTransactions")}
        </MenuItem>
        <MenuSeparator />
        {closed ? (
          <MenuItem onSelect={onReopen}>{t("account.reopen")}</MenuItem>
        ) : (
          <MenuItem tone="danger" onSelect={onClose}>
            {t("account.close")}
          </MenuItem>
        )}
      </MenuContent>
    </Menu>
  );
}
