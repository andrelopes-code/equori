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
import { useAccountActions } from "@/features/accounts/account-record/use-account-actions";
import { useT } from "@/i18n/i18n-provider";
import { useServed } from "@/ui/navigation/use-served";

type Account = components["schemas"]["Account"];

interface AccountHeaderMenuProps {
  account: Account;
  compact: boolean;
  onClose: () => void;
  onReopen: () => void;
  onUnlock: () => void;
  onImportFile: () => void;
}

// The menu of an account's page: the actions a phone has no room for, then the account's own.
export function AccountHeaderMenu({
  account,
  compact,
  onClose,
  onReopen,
  onUnlock,
  onImportFile,
}: AccountHeaderMenuProps) {
  const t = useT();
  const navigate = useNavigate();
  const served = useServed();
  const actions = useAccountActions(account);

  const { closed, property, security, foreignCurrency } = actions;
  const brokerage =
    account.kind === "brokerage" && account.parent_id === undefined;
  const edit = {
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
        {!closed && property && (
          <MenuItem onSelect={actions.newTransaction}>
            {t("account.newTransaction")}
          </MenuItem>
        )}
        {served(edit) && (
          <MenuItem
            onSelect={() => {
              void navigate(edit);
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
        {compact && !closed && foreignCurrency && (
          <MenuItem onSelect={actions.recordInvestment("exchange")}>
            {t("exchange.record")}
          </MenuItem>
        )}
        {compact && !closed && security && (
          <MenuItem onSelect={actions.recordInvestment("trade")}>
            {t("trade.record")}
          </MenuItem>
        )}
        {compact && !closed && security && (
          <MenuItem onSelect={actions.recordInvestment("investment_income")}>
            {t("income.record")}
          </MenuItem>
        )}
        {!closed && brokerage && (
          <MenuItem onSelect={onImportFile}>
            {t("investmentFile.action")}
          </MenuItem>
        )}
        <MenuItem onSelect={onUnlock}>{t("account.unlock")}</MenuItem>
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
