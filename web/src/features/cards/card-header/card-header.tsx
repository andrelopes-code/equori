import { Button } from "@slotted/react/button";
import {
  PageHeader,
  PageHeaderActions,
  PageHeaderHeading,
  PageHeaderMarks,
  PageHeaderSubheading,
  PageHeaderTitle,
  PageHeaderTitleArea,
  PageHeaderTitleRow,
  PageHeaderVisual,
} from "@slotted/react/page-header";
import { Tag } from "@slotted/react/tag";
import { Link, useNavigate } from "@tanstack/react-router";

import type { components } from "@/api/schema.gen";
import { AccountAvatar } from "@/features/accounts";
import { CardHeaderTabs } from "@/features/cards/card-header/card-header-tabs";
import { CardMenu } from "@/features/cards/card-header/card-menu";
import type { CardTab } from "@/features/cards/model/card-search";
import {
  statementStatusTone,
  statementStatusWords,
} from "@/features/cards/model/statement-words";
import { HelpLink } from "@/features/help";
import { useT } from "@/i18n/i18n-provider";
import {
  compactQuery,
  useMediaQuery,
  wideQuery,
} from "@/ui/runtime/use-media-query";
import { PageBack } from "@/ui/navigation/page-back";

type Account = components["schemas"]["Account"];
type Statement = components["schemas"]["StatementSummary"];

// RP-01: the card's mark, its name, the state of the statement purchases go on, where it is held
// and its cards; its tabs of related records (RP-03).
export function CardHeader({
  account,
  institution,
  lastFours,
  current,
  unpaid,
  tab,
  onTab,
  onInstallments,
  onClose,
  onReopen,
}: {
  account: Account;
  institution: string | undefined;
  lastFours: string[];
  current: Statement | undefined;
  unpaid: Statement | undefined;
  tab: CardTab;
  onTab: (tab: CardTab) => void;
  onInstallments: () => void;
  onClose: () => void;
  onReopen: () => void;
}) {
  const t = useT();
  const navigate = useNavigate();
  const wide = useMediaQuery(wideQuery);
  const compact = useMediaQuery(compactQuery);
  const closed = account.closed_on !== undefined;
  const where = [
    institution,
    ...lastFours.map((digits) => t("card.masked", { digits })),
  ].filter((p) => p !== undefined);
  return (
    <PageHeader size="lg">
      <PageHeaderTitleArea>
        {wide && (
          <PageBack render={(props) => <Link {...props} to="/cards" />}>
            {t("nav.cards")}
          </PageBack>
        )}
        <PageHeaderTitleRow>
          <PageHeaderVisual>
            <AccountAvatar account={account} size="lg" />
          </PageHeaderVisual>
          <PageHeaderTitle>
            <PageHeaderHeading>{account.name}</PageHeaderHeading>
            <PageHeaderMarks>
              {closed ? (
                <Tag size="sm" tone="secondary">
                  {t("card.closedTag")}
                </Tag>
              ) : (
                current !== undefined && (
                  <Tag size="sm" tone={statementStatusTone[current.status]}>
                    {t(statementStatusWords[current.status])}
                  </Tag>
                )
              )}
            </PageHeaderMarks>
            {where.length > 0 && (
              <PageHeaderSubheading className="ml-3">
                {where.join(" · ")}
              </PageHeaderSubheading>
            )}
          </PageHeaderTitle>
          <PageHeaderActions>
            <HelpLink page="installments" />
            {!closed && !compact && (
              <Button
                variant="outline"
                tone="secondary"
                onClick={onInstallments}
              >
                {t("card.installmentPurchase")}
              </Button>
            )}
            {!closed && unpaid !== undefined && (
              <Button
                onClick={() => {
                  void navigate({
                    to: "/cards/$accountId/statements/$statementId",
                    params: {
                      accountId: account.id,
                      statementId: unpaid.id,
                    },
                    search: { pay: true },
                  });
                }}
              >
                {t("card.payStatement")}
              </Button>
            )}
            <CardMenu
              account={account}
              closed={closed}
              compact={compact}
              onInstallments={onInstallments}
              onClose={onClose}
              onReopen={onReopen}
            />
          </PageHeaderActions>
        </PageHeaderTitleRow>
      </PageHeaderTitleArea>
      <CardHeaderTabs tab={tab} onTab={onTab} />
    </PageHeader>
  );
}
