import {
  PageHeader,
  PageHeaderHeading,
  PageHeaderMarks,
  PageHeaderSubheading,
  PageHeaderTitle,
  PageHeaderTitleArea,
  PageHeaderTitleRow,
  PageHeaderVisual,
} from "@slotted/react/page-header";
import { Tag } from "@slotted/react/tag";
import { Link } from "@tanstack/react-router";

import type { components } from "@/api/schema.gen";
import { kindTitle } from "@/features/accounts/model/account-kinds";
import { AccountAvatar } from "@/features/accounts/account-mark/account-avatar";
import { AccountHeaderActions } from "@/features/accounts/account-record/account-header-actions";
import { AccountHeaderTabs } from "@/features/accounts/account-record/account-header-tabs";
import { AccountRowStatus } from "@/features/accounts/account-mark/account-row-status";
import type { AccountTab } from "@/features/accounts/model/account-search";
import { formatDate } from "@/i18n/format";
import { useAppLocale, useT } from "@/i18n/i18n-provider";
import { HeaderProgress } from "@/ui/navigation/header-progress";
import {
  compactQuery,
  useMediaQuery,
  wideQuery,
} from "@/ui/runtime/use-media-query";
import { PageBack } from "@/ui/navigation/page-back";

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
  onImportFile,
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
  onImportFile: () => void;
  refreshing: boolean;
  scale: (code: string) => number;
}) {
  const t = useT();
  const [locale] = useAppLocale();
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
          <PageBack render={(props) => <Link {...props} to="/accounts" />}>
            {t("nav.accounts")}
          </PageBack>
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
          <AccountHeaderActions
            account={account}
            compact={compact}
            onClose={onClose}
            onReopen={onReopen}
            onUnlock={onUnlock}
            onImportFile={onImportFile}
          />
        </PageHeaderTitleRow>
      </PageHeaderTitleArea>
      <AccountHeaderTabs tabs={tabs} current={current} onTab={onTab} />
      <HeaderProgress loading={refreshing} />
    </PageHeader>
  );
}
