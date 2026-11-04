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
import { Tag } from "@slotted/react/tag";

import type { ModelUse } from "@/features/setup/api";
import { catalogLabel } from "@/features/setup/catalog-label";
import { UsePrivacy } from "@/features/setup/use-privacy";
import { useT } from "@/i18n/i18n-provider";

interface UseRowProps {
  use: ModelUse;
  onEdit: () => void;
}

// One use of a model: the chain it runs, what it sends, and whether the reader changed the chain.
export function UseRow({ use, onEdit }: UseRowProps) {
  const t = useT();
  const chain =
    use.targets.length === 0
      ? t("assistant.use.none")
      : use.targets.map((x) => `${x.provider_name} · ${x.model}`).join(" → ");

  return (
    <ListItem align="start">
      <ListItemContent>
        <ListItemBody>
          <ListItemLabel>
            {catalogLabel(t, `assistant.use.${use.id}`, use.id)}
          </ListItemLabel>
          <ListItemDescription>{chain}</ListItemDescription>
          <UsePrivacy use={use} />
        </ListItemBody>
        <ListItemEnd>
          <Tag
            size="sm"
            tone={use.default ? "secondary" : "accent"}
            title={t(
              use.default
                ? "assistant.use.default.hint"
                : "assistant.use.custom.hint",
            )}
          >
            {t(use.default ? "assistant.use.default" : "assistant.use.custom")}
          </Tag>
        </ListItemEnd>
      </ListItemContent>
      <ListItemActions>
        <Button size="sm" variant="ghost" tone="secondary" onClick={onEdit}>
          {t("assistant.use.edit")}
        </Button>
      </ListItemActions>
    </ListItem>
  );
}
