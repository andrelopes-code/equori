import { Button } from "@slotted/react/button";
import {
  ListItem,
  ListItemActions,
  ListItemBody,
  ListItemContent,
  ListItemDescription,
  ListItemEnd,
  ListItemLabel,
} from "@slotted/react/list-item";
import { Text } from "@slotted/react/typography";

import { useT } from "@/i18n/i18n-provider";

interface CriterionOptionProps {
  label: string;
  // What it reads; none for a signal, whose name says it.
  meaning?: string;
  // Whether the group holds the criterion.
  added: boolean;
  disabled: boolean;
  onAdd: () => void;
}

// A criterion of the panel: its name, what it reads, and the action or the words "no grupo".
export function CriterionOption({
  label,
  meaning,
  added,
  disabled,
  onAdd,
}: CriterionOptionProps) {
  const t = useT();

  return (
    <ListItem>
      <ListItemContent>
        <ListItemBody>
          <ListItemLabel>{label}</ListItemLabel>

          {meaning !== undefined && (
            <ListItemDescription>{meaning}</ListItemDescription>
          )}
        </ListItemBody>

        {added && (
          <ListItemEnd>
            <Text size="sm" tone="muted">
              {t("contributionPlan.criteria.added")}
            </Text>
          </ListItemEnd>
        )}
      </ListItemContent>

      {!added && (
        <ListItemActions>
          <Button
            size="sm"
            variant="outline"
            tone="secondary"
            disabled={disabled}
            aria-label={t("contributionPlan.criteria.addNamed", {
              name: label,
            })}
            onClick={onAdd}
          >
            {t("contributionPlan.criteria.addOne")}
          </Button>
        </ListItemActions>
      )}
    </ListItem>
  );
}
