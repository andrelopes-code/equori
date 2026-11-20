import { Link } from "@slotted/react/link";
import { Stack } from "@slotted/react/stack";
import { Text } from "@slotted/react/typography";
import { Fragment } from "react";

import type { components } from "@/api/schema.gen";
import { MissingQuoteActions } from "@/features/portfolio/contribution-plan/month/missing-quote-actions";
import { useT } from "@/i18n/i18n-provider";
import { routeTo } from "@/ui/navigation/route-to";

type Plan = components["schemas"]["ContributionPlan"];

interface IncompleteVerdictProps {
  view: Plan;
}

// Stands where the instrument code goes in the catalog sentence, so the code can be a link.
const marker = "\u0001";

// CN10: the verdict names each entry without a price or a rate as a link to its instrument page,
// and offers to record the price or the rate there.
export function IncompleteVerdict({ view }: IncompleteVerdictProps) {
  const t = useT();

  return (
    <Stack gap={3}>
      <Text>
        {view.missing.map((m, index) => {
          const [before = "", after = ""] = t(
            m.kind === "price"
              ? "contributionPlan.verdictMissingPrice"
              : "contributionPlan.verdictMissingRate",
            { name: marker },
          ).split(marker);

          return (
            <Fragment key={`${m.account_id ?? ""}${m.instrument}${m.kind}`}>
              {index > 0 && " "}

              {before}

              <Link
                render={routeTo({
                  to: "/instruments/$code",
                  params: { code: m.instrument },
                })}
              >
                {m.instrument}
              </Link>

              {after}
            </Fragment>
          );
        })}
      </Text>

      <MissingQuoteActions missing={view.missing} />
    </Stack>
  );
}
