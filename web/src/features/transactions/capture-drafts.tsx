import { InlineMessage } from "@slotted/react/inline-message";
import { List, ListEmpty, ListSection } from "@slotted/react/list";
import { Stack } from "@slotted/react/stack";

import { errorText } from "@/api/problem";
import type { components } from "@/api/schema.gen";
import { overrideWithChoice } from "@/features/transactions/capture-draft";
import type { LineOverride } from "@/features/transactions/capture-draft";
import { CaptureLineItem } from "@/features/transactions/capture-line-item";
import type { CaptureRow } from "@/features/transactions/capture-rows";
import type { CaptureSetup } from "@/features/transactions/capture-setup";
import { useT } from "@/i18n/i18n-provider";

type Account = components["schemas"]["Account"];

interface CaptureDraftsProps {
  rows: CaptureRow[];
  attention: number;
  loading: boolean;
  summary: string | null;
  error: Error | null;
  refusal: { index: number; message: string } | null;
  setup: CaptureSetup | null;
  accountsById: Map<string, Account>;
  payeeNames: Map<string, string>;
  overrides: Record<string, LineOverride>;
  onOverride: (index: number, next: LineOverride) => void;
  onEdit: (index: number) => void;
}

// The drafts read from the text, beside it, with what keeps them from being recorded.
export function CaptureDrafts({
  rows,
  attention,
  loading,
  summary,
  error,
  refusal,
  setup,
  accountsById,
  payeeNames,
  overrides,
  onOverride,
  onEdit,
}: CaptureDraftsProps) {
  const t = useT();

  const counted = t("capture.summary", { count: rows.length });
  const needing = t("capture.attention", { count: attention });
  const tally = attention === 0 ? counted : `${counted} · ${needing}`;

  return (
    <Stack gap={4}>
      {summary !== null && (
        <InlineMessage tone="danger" size="md" live="polite">
          {summary}
        </InlineMessage>
      )}

      {error !== null && (
        <InlineMessage tone="danger" size="md">
          {errorText(error, t)}
        </InlineMessage>
      )}

      <List
        variant="separated"
        aria-label={t("capture.drafts")}
        loading={loading}
      >
        <ListSection
          label={t("capture.drafts")}
          end={rows.length === 0 ? undefined : tally}
        >
          {rows.length === 0 && <ListEmpty>{t("capture.empty")}</ListEmpty>}
          {rows.length > 0 &&
            setup !== null &&
            rows.map((r, i) => (
              <CaptureLineItem
                key={r.key}
                line={r.line}
                draft={r.draft}
                issues={r.issues}
                problems={r.problems}
                edited={r.edited}
                suggested={r.suggested}
                refusal={refusal?.index === i ? refusal.message : null}
                accounts={accountsById}
                payees={payeeNames}
                baseCurrency={setup.base}
                scale={setup.scale}
                onChoose={(issue, choice) => {
                  onOverride(
                    i,
                    overrideWithChoice(overrides[r.key], issue, choice),
                  );
                }}
                onEdit={() => {
                  onEdit(i);
                }}
              />
            ))}
        </ListSection>
      </List>
    </Stack>
  );
}
