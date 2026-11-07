import { Button } from "@slotted/react/button";
import { Field, FieldLabel } from "@slotted/react/field";
import {
  ListItem,
  ListItemActions,
  ListItemBody,
  ListItemContent,
  ListItemDescription,
  ListItemEnd,
  ListItemLabel,
} from "@slotted/react/list-item";
import { TextField } from "@slotted/react/text-field";
import { Text } from "@slotted/react/typography";
import { useState } from "react";

import type { components } from "@/api/schema.gen";
import {
  actionSentence,
  conditionSentence,
} from "@/features/categories/rule-sentence";
import type { RuleWords } from "@/features/categories/rule-sentence";
import styles from "@/features/categories/suggestion-item.module.css";
import { useAppLocale, useT } from "@/i18n/i18n-provider";

type Suggestion = components["schemas"]["RuleSuggestion"];

interface SuggestionItemProps {
  suggestion: Suggestion;
  words: RuleWords;
  busy: boolean;
  dismissing: boolean;
  onAccept: (name: string) => void;
  onDismiss: () => void;
}

// A24: a rule the server proposes from repeated manual corrections, accepted under a name.
export function SuggestionItem({
  suggestion,
  words,
  busy,
  dismissing,
  onAccept,
  onDismiss,
}: SuggestionItemProps) {
  const t = useT();
  const [locale] = useAppLocale();

  const [naming, setNaming] = useState(false);
  const [name, setName] = useState(
    proposedName(suggestion, words, t("suggestion.defaultName")),
  );

  const outcome = suggestion.actions
    .map((a) => actionSentence(a, words))
    .join("; ");

  function handlePrimary() {
    if (naming) onAccept(name.trim());
    else setNaming(true);
  }

  return (
    <ListItem size="lg">
      <ListItemContent>
        <ListItemBody>
          <ListItemLabel>
            <Text weight="semibold">
              {outcome.charAt(0).toLocaleUpperCase(locale) + outcome.slice(1)}
            </Text>
          </ListItemLabel>
          <ListItemDescription>
            <ul className={styles.conditions}>
              {suggestion.conditions.map((condition, i) => (
                <li key={i}>
                  <Text size="sm" tone="muted">
                    {t(
                      i === 0
                        ? "suggestion.condition.first"
                        : "suggestion.condition.next",
                      { condition: conditionSentence(condition, words) },
                    )}
                  </Text>
                </li>
              ))}
            </ul>
          </ListItemDescription>
          {naming && (
            <Field required className={styles.name}>
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
        </ListItemBody>
        <ListItemEnd>
          <Text size="sm" tone="muted" numeric="tabular">
            {t("suggestion.basis", {
              count: suggestion.example_transaction_ids.length,
            })}
          </Text>
        </ListItemEnd>
      </ListItemContent>
      <ListItemActions>
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
          onClick={handlePrimary}
        >
          {naming ? t("suggestion.create") : t("suggestion.accept")}
        </Button>
      </ListItemActions>
    </ListItem>
  );
}

// The category the rule files under, as the leaf of its path.
function proposedName(
  suggestion: Suggestion,
  words: RuleWords,
  fallback: string,
): string {
  const id = suggestion.actions[0]?.category_id;

  return (
    (id === undefined ? undefined : words.name(id).split(" › ").at(-1)) ??
    fallback
  );
}
