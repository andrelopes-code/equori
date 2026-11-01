import { Field, FieldError, FieldLabel } from "@slotted/react/field";
import {
  FieldGroup,
  FieldGroupContent,
  FieldGroupLegend,
} from "@slotted/react/field-group";
import { InlineMessage } from "@slotted/react/inline-message";
import { Tag } from "@slotted/react/tag";
import { TextField } from "@slotted/react/text-field";

import { AccountOpeningSection, CardSetupSection } from "@/features/accounts";
import type { AccountDraft } from "@/features/accounts";
import type { GroupRun } from "@/features/start/use-start-run";
import { useT } from "@/i18n/i18n-provider";

interface StartAccountGroupProps {
  draft: AccountDraft;
  run: GroupRun;
  scale: number;
  onChange: (next: AccountDraft) => void;
}

// One account of the walkthrough: its name, its opening balance and, for a card, its setup. A
// created account draws its fields read only.
export function StartAccountGroup({
  draft,
  run,
  scale,
  onChange,
}: StartAccountGroupProps) {
  const t = useT();
  const kind = draft.kind ?? "checking";

  return (
    <FieldGroup kind="section" disabled={run.state === "created"}>
      <FieldGroupLegend>{draft.name}</FieldGroupLegend>
      <FieldGroupContent>
        {run.state === "created" && (
          <Tag tone="success">{t("start.details.created")}</Tag>
        )}
        {run.summary !== null && (
          <InlineMessage tone="danger">{run.summary}</InlineMessage>
        )}

        <Field invalid={run.errors.name !== undefined} required>
          <FieldLabel>{t("accountForm.name")}</FieldLabel>
          <TextField
            name="name"
            value={draft.name}
            maxLength={120}
            onChange={(event) => {
              onChange({ ...draft, name: event.target.value });
            }}
          />
          {run.errors.name !== undefined && (
            <FieldError>{run.errors.name}</FieldError>
          )}
        </Field>

        <AccountOpeningSection
          kind={kind}
          value={draft.opening}
          onChange={(opening) => {
            onChange({ ...draft, opening });
          }}
          currency={draft.currency}
          scale={scale}
        />

        {kind === "credit_card" && (
          <CardSetupSection
            value={draft.card}
            onChange={(card) => {
              onChange({ ...draft, card });
            }}
            errors={run.errors}
            currency={draft.currency}
            scale={scale}
          />
        )}
      </FieldGroupContent>
    </FieldGroup>
  );
}
