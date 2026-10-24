import { Button, IconButton } from "@slotted/react/button";
import { Glyph, Icon } from "@slotted/react/icon";
import {
  Menu,
  MenuContent,
  MenuItem,
  MenuSeparator,
  MenuTrigger,
} from "@slotted/react/menu";
import {
  PageHeader,
  PageHeaderActions,
  PageHeaderBack,
  PageHeaderHeading,
  PageHeaderMarks,
  PageHeaderNav,
  PageHeaderSubheading,
  PageHeaderTabs,
  PageHeaderTitle,
  PageHeaderTitleArea,
  PageHeaderTitleRow,
  PageHeaderVisual,
} from "@slotted/react/page-header";
import { Tab, TabList, Tabs } from "@slotted/react/tabs";
import { Tag } from "@slotted/react/tag";
import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";

import { useApi } from "@/api/api-context";
import type { components } from "@/api/schema.gen";
import { kindTitle } from "@/features/accounts/account-kinds";
import { AccountAvatar } from "@/features/accounts/account-avatar";
import { AccountRowStatus } from "@/features/accounts/account-row-status";
import type { AccountTab } from "@/features/accounts/account-search";
import { instrumentsQuery } from "@/features/setup";
import { formatDate } from "@/i18n/format";
import { useAppLocale, useT } from "@/i18n/i18n-provider";
import { HeaderProgress } from "@/ui/header-progress";
import { compactQuery, useMediaQuery, wideQuery } from "@/ui/use-media-query";

type Account = components["schemas"]["Account"];
type Institution = components["schemas"]["Institution"];
type ExternalAccount = components["schemas"]["ExternalAccount"];

export interface TabEntry {
  tab: AccountTab;
  label: string;
}

// RP-01: the record's visual, its name, its kind and its health, one line naming where it is
// held, and its tabs of related records (RP-03).
export function AccountHeader({
  account,
  institution,
  external,
  tabs,
  current,
  onTab,
  onClose,
  onReopen,
  onUnlock,
  refreshing,
  scale,
}: {
  account: Account;
  institution: Institution | undefined;
  external: ExternalAccount | undefined;
  tabs: TabEntry[];
  current: AccountTab;
  onTab: (tab: AccountTab) => void;
  onClose: () => void;
  onReopen: () => void;
  onUnlock: () => void;
  refreshing: boolean;
  scale: (code: string) => number;
}) {
  const t = useT();
  const [locale] = useAppLocale();
  const navigate = useNavigate();
  const instruments = useQuery(instrumentsQuery(useApi()));
  // A trade is recorded on the account that holds the security.
  const security = (instruments.data?.items ?? []).some(
    (i) => i.code === account.currency && i.type !== "currency",
  );
  const recordInvestment = (kind: "trade" | "investment_income") => () => {
    void navigate({
      to: "/transactions/new",
      search: { account_id: account.id, kind },
    });
  };
  const wide = useMediaQuery(wideQuery);
  const compact = useMediaQuery(compactQuery);
  const closed = account.closed_on !== undefined;
  const balanceAccount =
    account.class === "asset" || account.class === "liability";
  const where = [
    institution?.name,
    external?.number_last4 === undefined
      ? undefined
      : t("account.lastFour", { digits: external.number_last4 }),
    external?.last_synced_on === undefined
      ? undefined
      : t("account.syncedOn", {
          date: formatDate(external.last_synced_on, locale),
        }),
    closed && account.closed_on !== undefined
      ? t("account.closedOn", { date: formatDate(account.closed_on, locale) })
      : undefined,
  ].filter((part): part is string => part !== undefined);

  return (
    <PageHeader size="lg">
      <PageHeaderTitleArea>
        {wide && (
          <PageHeaderNav>
            <PageHeaderBack
              render={(props) => <Link {...props} to="/accounts" />}
            >
              {t("nav.accounts")}
            </PageHeaderBack>
          </PageHeaderNav>
        )}
        <PageHeaderTitleRow>
          <PageHeaderVisual>
            <AccountAvatar account={account} size="lg" />
          </PageHeaderVisual>
          <PageHeaderTitle>
            <PageHeaderHeading>{account.name}</PageHeaderHeading>
            <PageHeaderMarks>
              {account.kind !== undefined && (
                <Tag size="sm" tone="secondary">
                  {t(kindTitle[account.kind])}
                </Tag>
              )}
              {closed ? (
                <Tag size="sm" tone="secondary">
                  {t("balanceSheet.closed")}
                </Tag>
              ) : (
                balanceAccount && (
                  <AccountRowStatus account={account} scale={scale} />
                )
              )}
            </PageHeaderMarks>
            {where.length > 0 && (
              <PageHeaderSubheading>{where.join(" · ")}</PageHeaderSubheading>
            )}
          </PageHeaderTitle>
          <PageHeaderActions>
            {!closed && !compact && (
              <>
                <Button
                  variant="outline"
                  tone="secondary"
                  onClick={() => {
                    void navigate({
                      to: "/accounts/$id/import",
                      params: { id: account.id },
                    });
                  }}
                >
                  {t("account.import")}
                </Button>
                <Button
                  variant="outline"
                  tone="secondary"
                  onClick={() => {
                    void navigate({
                      to: "/accounts/$id",
                      params: { id: account.id },
                      search: { tab: "reconciliation", assert: true },
                    });
                  }}
                >
                  {t("account.recordBalance")}
                </Button>
                {security && (
                  <Button
                    variant="outline"
                    tone="secondary"
                    onClick={recordInvestment("trade")}
                  >
                    {t("trade.record")}
                  </Button>
                )}
                {security && (
                  <Button
                    variant="outline"
                    tone="secondary"
                    onClick={recordInvestment("investment_income")}
                  >
                    {t("income.record")}
                  </Button>
                )}
              </>
            )}
            {!closed && (
              <Button
                start={
                  <Icon size="sm">
                    <Glyph name="plus" />
                  </Icon>
                }
                onClick={() => {
                  void navigate({
                    to: "/transactions/new",
                    search: { account_id: account.id },
                  });
                }}
              >
                {t("account.newTransaction")}
              </Button>
            )}
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
                <MenuItem
                  onSelect={() => {
                    void navigate({
                      to: "/accounts/$id/edit",
                      params: { id: account.id },
                    });
                  }}
                >
                  {t("account.edit")}
                </MenuItem>
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
                {compact && !closed && (
                  <>
                    <MenuItem
                      onSelect={() => {
                        void navigate({
                          to: "/accounts/$id/import",
                          params: { id: account.id },
                        });
                      }}
                    >
                      {t("account.import")}
                    </MenuItem>
                    <MenuItem
                      onSelect={() => {
                        void navigate({
                          to: "/accounts/$id",
                          params: { id: account.id },
                          search: { tab: "reconciliation", assert: true },
                        });
                      }}
                    >
                      {t("account.recordBalance")}
                    </MenuItem>
                    {security && (
                      <>
                        <MenuItem onSelect={recordInvestment("trade")}>
                          {t("trade.record")}
                        </MenuItem>
                        <MenuItem
                          onSelect={recordInvestment("investment_income")}
                        >
                          {t("income.record")}
                        </MenuItem>
                      </>
                    )}
                  </>
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
          </PageHeaderActions>
        </PageHeaderTitleRow>
      </PageHeaderTitleArea>
      <PageHeaderTabs>
        <Tabs
          value={current}
          onValueChange={(value) => {
            const entry = tabs.find((e) => e.tab === value);
            if (entry !== undefined) onTab(entry.tab);
          }}
        >
          <TabList aria-label={t("account.tabs")}>
            {tabs.map((entry) => (
              <Tab key={entry.tab} value={entry.tab}>
                {entry.label}
              </Tab>
            ))}
          </TabList>
        </Tabs>
      </PageHeaderTabs>
      <HeaderProgress loading={refreshing} />
    </PageHeader>
  );
}
