import { Button } from "@slotted/react/button";
import { Card, CardBody, CardFooter, CardHeader } from "@slotted/react/card";
import { Field, FieldLabel } from "@slotted/react/field";
import { Inline } from "@slotted/react/inline";
import { TextField } from "@slotted/react/text-field";
import { Heading, Text } from "@slotted/react/typography";
import { useState } from "react";

import type { components } from "@/api/schema.gen";
import type { RuleWords } from "@/features/categories/rule-sentence";
import { ruleSummary } from "@/features/categories/rule-summary";
import { useT } from "@/i18n/i18n-provider";

type Suggestion = components["schemas"]["RuleSuggestion"];

// A24: a rule the server proposes from repeated manual corrections, accepted under a name.
export function SuggestionCard({
  suggestion,
  words,
  busy,
  onAccept,
  onDismiss,
}: {
  suggestion: Suggestion;
  words: RuleWords;
  busy: boolean;
  onAccept: (name: string) => void;
  onDismiss: () => void;
}) {
  const t = useT();
  const first = suggestion.actions[0];
  const proposed =
    first === undefined
      ? t("suggestion.defaultName")
      : ((first.category_id !== undefined
          ? words.name(first.category_id).split(" › ").at(-1)
          : undefined) ?? t("suggestion.defaultName"));
  const [naming, setNaming] = useState(false);
  const [name, setName] = useState(proposed);
  return (
    <Card size="sm">
      <CardHeader>
        <Heading level={3} size="sm">
          {t("suggestion.title")}
        </Heading>
        <Text size="sm" tone="muted">
          {t("suggestion.basis", {
            count: suggestion.example_transaction_ids.length,
          })}
        </Text>
      </CardHeader>
      <CardBody>
        {naming ? (
          <Field>
            <FieldLabel>{t("rules.name")}</FieldLabel>
            <TextField
              value={name}
              maxLength={120}
              onChange={(event) => {
                setName(event.target.value);
              }}
            />
          </Field>
        ) : (
          <Text>{ruleSummary(suggestion, words)}</Text>
        )}
      </CardBody>
      <CardFooter>
        <Inline gap={2} justify="end">
          <Button
            size="sm"
            variant="ghost"
            tone="secondary"
            onClick={
              naming
                ? () => {
                    setNaming(false);
                  }
                : onDismiss
            }
          >
            {naming ? t("detail.cancel") : t("suggestion.dismiss")}
          </Button>
          <Button
            size="sm"
            loading={busy}
            disabled={naming && name.trim() === ""}
            onClick={() => {
              if (naming) onAccept(name.trim());
              else setNaming(true);
            }}
          >
            {naming ? t("suggestion.create") : t("suggestion.accept")}
          </Button>
        </Inline>
      </CardFooter>
    </Card>
  );
}
