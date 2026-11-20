import { Button } from "@slotted/react/button";
import { Inline } from "@slotted/react/inline";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";

import { useApi } from "@/api/api-context";
import type { components } from "@/api/schema.gen";
import { RecordPriceDialog } from "@/features/instruments";
import {
  missingQuotes,
  type MissingQuote,
} from "@/features/portfolio/contribution-plan/month/missing-quotes";
import { instrumentsQuery, settingsQuery } from "@/features/setup";
import { useT } from "@/i18n/i18n-provider";

type Missing = components["schemas"]["ContributionMissing"];

interface MissingQuoteActionsProps {
  missing: readonly Missing[];
}

// One button per instrument of the verdict that opens the price dialog of the instruments in
// place; the write marks the plan stale, so the plan divides the amount once the price is in.
export function MissingQuoteActions({ missing }: MissingQuoteActionsProps) {
  const t = useT();
  const api = useApi();
  const instruments = useQuery(instrumentsQuery(api));
  const base = useQuery(settingsQuery(api)).data?.base_currency;

  const [recording, setRecording] = useState<MissingQuote | null>(null);

  const entries = missingQuotes(missing, instruments.data?.items ?? [], base);

  if (entries.length === 0) return null;

  return (
    <>
      <Inline gap={2} wrap="wrap">
        {entries.map((entry) => (
          <Button
            key={entry.instrument}
            size="sm"
            variant="outline"
            tone="secondary"
            onClick={() => {
              setRecording(entry);
            }}
          >
            {t(
              entry.kind === "rate"
                ? "contributionPlan.recordRate"
                : "contributionPlan.recordPrice",
              { name: entry.instrument },
            )}
          </Button>
        ))}
      </Inline>

      {recording !== null && (
        <RecordPriceDialog
          instrument={recording.instrument}
          quote={recording.quote}
          onDone={() => {
            setRecording(null);
          }}
          onCancel={() => {
            setRecording(null);
          }}
        />
      )}
    </>
  );
}
