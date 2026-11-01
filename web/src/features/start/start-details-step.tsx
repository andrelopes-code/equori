import { Button } from "@slotted/react/button";
import { Inline } from "@slotted/react/inline";
import { Stack } from "@slotted/react/stack";
import { Text } from "@slotted/react/typography";

import type { AccountDraft } from "@/features/accounts";
import { StartAccountGroup } from "@/features/start/start-account-group";
import { pending } from "@/features/start/use-start-run";
import type { GroupRun } from "@/features/start/use-start-run";
import { useT } from "@/i18n/i18n-provider";
import { FormLayout } from "@/ui/form-layout";

interface StartDetailsStepProps {
  drafts: readonly AccountDraft[];
  runs: readonly GroupRun[];
  scale: (code: string) => number;
  running: boolean;
  allCreated: boolean;
  anyCreated: boolean;
  onDraftChange: (index: number, next: AccountDraft) => void;
  onCreate: () => void;
  onBack: () => void;
  onContinue: () => void;
}

// Step 2: each account with its opening balance; the accounts are created together.
export function StartDetailsStep({
  drafts,
  runs,
  scale,
  running,
  allCreated,
  anyCreated,
  onDraftChange,
  onCreate,
  onBack,
  onContinue,
}: StartDetailsStepProps) {
  const t = useT();

  return (
    <Stack gap={6}>
      <Text tone="muted">{t("start.details.hint")}</Text>

      <FormLayout>
        <Stack gap={8}>
          {drafts.map((draft, index) => (
            <StartAccountGroup
              // The drafts keep their order for the life of the step.
              key={`${draft.kind ?? ""}-${String(index)}`}
              draft={draft}
              run={runs[index] ?? pending}
              scale={scale(draft.currency)}
              onChange={(next) => {
                onDraftChange(index, next);
              }}
            />
          ))}
        </Stack>
      </FormLayout>

      <Inline gap={3} wrap="wrap">
        <Button
          variant="ghost"
          tone="secondary"
          disabled={anyCreated || running}
          onClick={onBack}
        >
          {t("start.back")}
        </Button>
        {allCreated ? (
          <Button onClick={onContinue}>{t("start.continue")}</Button>
        ) : (
          <Button loading={running} onClick={onCreate}>
            {t("start.details.create")}
          </Button>
        )}
      </Inline>
    </Stack>
  );
}
