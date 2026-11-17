import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";

import { useApi } from "@/api/api-context";
import type { components } from "@/api/schema.gen";
import type { CardSearch, CardTab } from "@/features/cards/model/card-search";
import { CardSettingsTab } from "@/features/cards/card-settings-tab/card-settings-tab";
import { PlansTab } from "@/features/cards/plans-tab/plans-tab";
import { PlasticCardsTab } from "@/features/cards/plastic-cards-tab/plastic-cards-tab";
import { StatementsTab } from "@/features/cards/statements-tab/statements-tab";
import { institutionsQuery } from "@/features/setup";

type Account = components["schemas"]["Account"];
type Statement = components["schemas"]["StatementSummary"];

interface CardTabPanelProps {
  tab: CardTab;
  account: Account;
  search: CardSearch;
  statements: readonly Statement[];
  loading: boolean;
  openReference: string | undefined;
  onEarlier: () => void;
  scale: (code: string) => number;
}

// The region under a card's tabs.
export function CardTabPanel({
  tab,
  account,
  search,
  statements,
  loading,
  openReference,
  onEarlier,
  scale,
}: CardTabPanelProps) {
  const navigate = useNavigate();
  const institutions = useQuery(institutionsQuery(useApi()));
  const institution = institutions.data?.find(
    (i) => i.id === account.institution_id,
  );

  function openRule(open: boolean) {
    const merged: CardSearch = { ...search };
    delete merged.rule;
    void navigate({
      to: "/cards/$accountId",
      params: { accountId: account.id },
      search: open ? { ...merged, rule: true as const } : merged,
      replace: true,
    });
  }

  return (
    <>
      {tab === "statements" && (
        <StatementsTab
          accountId={account.id}
          statements={statements}
          loading={loading}
          onEarlier={onEarlier}
          scale={scale}
        />
      )}

      {tab === "plans" && (
        <PlansTab
          accountId={account.id}
          statements={statements}
          openReference={openReference}
          scale={scale}
        />
      )}

      {tab === "cards" && (
        <PlasticCardsTab account={account} institution={institution} />
      )}

      {tab === "settings" && (
        <CardSettingsTab
          account={account}
          institution={institution}
          ruleOpen={search.rule === true}
          onRuleOpen={openRule}
          scale={scale}
        />
      )}
    </>
  );
}
