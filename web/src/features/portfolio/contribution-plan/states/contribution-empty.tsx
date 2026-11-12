import { Button, ButtonLink } from "@slotted/react/button";
import {
  ResultState,
  ResultStateActions,
  ResultStateContent,
  ResultStateTitle,
} from "@slotted/react/result-state";
import { useQuery } from "@tanstack/react-query";

import { useApi } from "@/api/api-context";
import type { components } from "@/api/schema.gen";
import type { PlanDraft } from "@/features/portfolio/contribution-plan/model/plan-draft";
import {
  planFromPortfolio,
  typeOfEntry,
} from "@/features/portfolio/contribution-plan/model/plan-from-portfolio";
import { typeLabel } from "@/features/instruments";
import { instrumentsQuery } from "@/features/setup";
import { useT } from "@/i18n/i18n-provider";
import { routeTo } from "@/ui/navigation/route-to";

type Plan = components["schemas"]["ContributionPlan"];

interface ContributionEmptyProps {
  view: Plan;
  onStart: (draft: PlanDraft) => void;
}

// A book without a plan: the two ways to start one (CN12), and the first purchase when the book
// holds no position either.
export function ContributionEmpty({ view, onStart }: ContributionEmptyProps) {
  const t = useT();
  const api = useApi();
  const instruments = useQuery(instrumentsQuery(api));

  const types = new Map(
    (instruments.data?.items ?? []).map((i) => [i.code, i.type]),
  );
  const held = view.outside.length > 0;

  function handlePortfolio() {
    onStart(
      planFromPortfolio(
        view.outside.map((entry) => ({
          entry,
          type: typeOfEntry(entry, types),
        })),
        (type) => typeLabel(t, type),
      ),
    );
  }

  function handleScratch() {
    onStart({ classes: [{ name: "", targetBp: 10000, members: [] }] });
  }

  return (
    <ResultState status="empty" reach="section">
      <ResultStateContent>
        <ResultStateTitle>{t("contributionPlan.emptyBody")}</ResultStateTitle>
      </ResultStateContent>

      <ResultStateActions>
        <Button
          disabled={!held || instruments.data === undefined}
          onClick={handlePortfolio}
        >
          {t("contributionPlan.startPortfolio")}
        </Button>

        <Button variant="outline" tone="secondary" onClick={handleScratch}>
          {t("contributionPlan.startScratch")}
        </Button>

        {!held && (
          <ButtonLink
            variant="ghost"
            tone="secondary"
            render={routeTo({
              to: "/transactions/new",
              search: { kind: "trade" },
            })}
          >
            {t("contributionPlan.firstPurchase")}
          </ButtonLink>
        )}
      </ResultStateActions>
    </ResultState>
  );
}
