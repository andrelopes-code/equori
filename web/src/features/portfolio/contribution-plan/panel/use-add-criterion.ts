import { useQuery } from "@tanstack/react-query";

import { useApi } from "@/api/api-context";
import { meQuery } from "@/features/session";
import { marketDataFeedsQuery, useSetMarketDataFeed } from "@/features/setup";
import {
  fearGreedFact,
  fearGreedFeed,
} from "@/features/portfolio/contribution-plan/criteria/model/criteria-catalog";
import { criterionText } from "@/features/portfolio/contribution-plan/criteria/model/criterion-text";
import { addCriteria } from "@/features/portfolio/contribution-plan/panel/criteria-edits";
import type { Criteria } from "@/features/portfolio/contribution-plan/panel/use-criteria";
import { useT } from "@/i18n/i18n-provider";

// Adds criteria to a group. The index needs its source: an administrator turns it on with the first
// criterion that reads it, after the criterion is saved (CO17).
export function useAddCriterion(group: string, criteria: Criteria) {
  const t = useT();
  const api = useApi();
  const admin = useQuery(meQuery(api)).data?.role === "admin";
  const feeds = useQuery(marketDataFeedsQuery(api)).data;
  const setFeed = useSetMarketDataFeed();

  const off =
    feeds?.some((feed) => feed.id === fearGreedFeed && !feed.enabled) === true;

  return {
    addOwn: (text: string, onSaved: () => void) => {
      criteria.save(addCriteria(group, [{ text, fact: "" }]), { onSaved });
    },
    addFacts: (facts: readonly string[], onSaved: () => void) => {
      const added = facts.map((fact) => ({
        fact,
        text: criterionText(t, fact, fact),
      }));

      criteria.save(addCriteria(group, added), {
        onSaved: () => {
          onSaved();
          if (admin && off && facts.includes(fearGreedFact))
            setFeed.mutate({ id: fearGreedFeed, enabled: true });
        },
      });
    },
  };
}
