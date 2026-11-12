import { Link } from "@slotted/react/link";
import { Stack } from "@slotted/react/stack";

import type { components } from "@/api/schema.gen";
import { useT } from "@/i18n/i18n-provider";
import { FormNotice } from "@/ui/form-layout/form-notice";
import { routeTo } from "@/ui/navigation/route-to";

type Plan = components["schemas"]["ContributionPlan"];

interface IncompleteNoticeProps {
  view: Plan;
}

// CN10: the members without a price or a rate, each a link to the page of its instrument.
export function IncompleteNotice({ view }: IncompleteNoticeProps) {
  const t = useT();

  if (view.status !== "incomplete" || view.missing.length === 0) return null;

  return (
    <FormNotice tone="info">
      <Stack gap={1}>
        <span>{t("contributionPlan.incomplete")}</span>

        {view.missing.map((m) => (
          <Link
            key={`${m.account_id ?? ""}${m.instrument}${m.kind}`}
            render={routeTo({
              to: "/instruments/$code",
              params: { code: m.instrument },
            })}
          >
            {t(
              m.kind === "price"
                ? "contributionPlan.missingPrice"
                : "contributionPlan.missingRate",
              { name: m.instrument },
            )}
          </Link>
        ))}
      </Stack>
    </FormNotice>
  );
}
