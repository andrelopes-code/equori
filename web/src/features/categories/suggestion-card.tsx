import { Button } from "@slotted/react/button";
import { Card, CardBody, CardFooter, CardHeader } from "@slotted/react/card";
import { Field, FieldLabel } from "@slotted/react/field";
import { Inline } from "@slotted/react/inline";
import { Stack } from "@slotted/react/stack";
import { TextField } from "@slotted/react/text-field";
import { Heading, Text } from "@slotted/react/typography";
import { useState } from "react";

import type { components } from "@/api/schema.gen";
import {
  actionSentence,
  conditionSentence,
} from "@/features/categories/rule-sentence";
import type { RuleWords } from "@/features/categories/rule-sentence";
import styles from "@/features/categories/suggestion-card.module.css";
import { useAppLocale, useT } from "@/i18n/i18n-provider";

type Suggestion = components["schemas"]["RuleSuggestion"];

// A24: a rule the server proposes from repeated manual corrections, accepted under a name.
export function SuggestionCard({
  suggestion,
  words,
  busy,
  dismissing,
  onAccept,
  onDismiss,
}: {
  suggestion: Suggestion;
  words: RuleWords;
  busy: boolean;
  dismissing: boolean;
  onAccept: (name: string) => void;
  onDismiss: () => void;
}) {
  const t = useT();
  const [locale] = useAppLocale();
  const first = suggestion.actions[0];
  const proposed =
    first === undefined
      ? t("suggestion.defaultName")
      : ((first.category_id !== undefined
          ? words.name(first.category_id).split(" › ").at(-1)
          : undefined) ?? t("suggestion.defaultName"));
  const [naming, setNaming] = useState(false);
  const [name, setName] = useState(proposed);
  const outcome = suggestion.actions
    .map((a) => actionSentence(a, words))
    .join("; ");
  return (
    <Card size="sm">
      <CardHeader>
        <Heading level={3} size="sm">
          {outcome.charAt(0).toLocaleUpperCase(locale) + outcome.slice(1)}
        </Heading>
        <Text size="sm" tone="muted">
          {t("suggestion.basis", {
            count: suggestion.example_transaction_ids.length,
          })}
        </Text>
      </CardHeader>
      <CardBody>
        <Stack gap={4}>
          <Stack gap={2}>
            <Text size="sm" weight="semibold">
              {t("ruleEditor.when")}
            </Text>
            <ul className={styles.lines}>
              {suggestion.conditions.map((condition, i) => (
                <li key={i} className={styles.line}>
                  <Text size="sm" tone="muted" className={styles.join}>
                    {i === 0 ? "" : t("ruleEditor.and")}
                  </Text>
                  <Text size="sm">{conditionSentence(condition, words)}</Text>
                </li>
              ))}
            </ul>
          </Stack>
          {naming && (
            <Field required>
              <FieldLabel>{t("rules.name")}</FieldLabel>
              <TextField
                value={name}
                maxLength={120}
                onChange={(event) => {
                  setName(event.target.value);
                }}
              />
            </Field>
          )}
        </Stack>
      </CardBody>
      <CardFooter>
        <Inline gap={2} justify="end">
          <Button
            size="sm"
            variant="ghost"
            tone="secondary"
            loading={!naming && dismissing}
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
