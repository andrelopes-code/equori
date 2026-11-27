import { Button } from "@slotted/react/button";
import { Glyph, Icon } from "@slotted/react/icon";
import { PageHeaderActions } from "@slotted/react/page-header";

import type { components } from "@/api/schema.gen";
import { AccountHeaderMenu } from "@/features/accounts/account-record/account-header-menu";
import { useAccountActions } from "@/features/accounts/account-record/use-account-actions";
import { useT } from "@/i18n/i18n-provider";

type Account = components["schemas"]["Account"];

interface AccountHeaderActionsProps {
  account: Account;
  compact: boolean;
  onClose: () => void;
  onReopen: () => void;
  onUnlock: () => void;
  onImportFile: () => void;
}

// The actions of an account's page, from the lightest to the primary, then the menu. A property's
// primary is "Revalue" and its new transaction moves to the menu (K9).
export function AccountHeaderActions({
  account,
  compact,
  onClose,
  onReopen,
  onUnlock,
  onImportFile,
}: AccountHeaderActionsProps) {
  const t = useT();
  const actions = useAccountActions(account);

  const { closed, property, security, foreignCurrency } = actions;

  return (
    <PageHeaderActions>
      {!closed && !compact && !property && (
        <>
          <Button
            variant="outline"
            tone="secondary"
            onClick={actions.importStatement}
          >
            {t("account.import")}
          </Button>
          <Button
            variant="outline"
            tone="secondary"
            onClick={actions.recordBalance}
          >
            {t("account.recordBalance")}
          </Button>
          {foreignCurrency && (
            <Button
              variant="outline"
              tone="secondary"
              onClick={actions.recordInvestment("exchange")}
            >
              {t("exchange.record")}
            </Button>
          )}
          {security && (
            <Button
              variant="outline"
              tone="secondary"
              onClick={actions.recordInvestment("trade")}
            >
              {t("trade.record")}
            </Button>
          )}
          {security && (
            <Button
              variant="outline"
              tone="secondary"
              onClick={actions.recordInvestment("investment_income")}
            >
              {t("income.record")}
            </Button>
          )}
        </>
      )}
      {!closed && property && (
        <Button onClick={actions.recordBalance}>{t("property.revalue")}</Button>
      )}
      {!closed && !property && (
        <Button
          start={
            <Icon size="sm">
              <Glyph name="plus" />
            </Icon>
          }
          onClick={actions.newTransaction}
        >
          {t("account.newTransaction")}
        </Button>
      )}
      <AccountHeaderMenu
        account={account}
        compact={compact}
        onClose={onClose}
        onReopen={onReopen}
        onUnlock={onUnlock}
        onImportFile={onImportFile}
      />
    </PageHeaderActions>
  );
}
