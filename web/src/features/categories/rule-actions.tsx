import { IconButton } from "@slotted/react/button";
import { Glyph, Icon } from "@slotted/react/icon";
import {
  Menu,
  MenuContent,
  MenuItem,
  MenuSeparator,
  MenuTrigger,
} from "@slotted/react/menu";

import type { components } from "@/api/schema.gen";
import type { RuleAction } from "@/features/categories/rule-list";
import { useT } from "@/i18n/i18n-provider";

type Rule = components["schemas"]["Rule"];

export function RuleActions({
  rule,
  onAction,
}: {
  rule: Rule;
  onAction: (rule: Rule, action: RuleAction) => void;
}) {
  const t = useT();
  return (
    <Menu>
      <MenuTrigger
        render={(props) => (
          <IconButton
            {...props}
            size="sm"
            variant="ghost"
            tone="secondary"
            aria-label={t("rules.actions", { name: rule.name })}
          >
            <Icon>
              <Glyph name="ellipsis" />
            </Icon>
          </IconButton>
        )}
      />
      <MenuContent>
        <MenuItem
          onSelect={() => {
            onAction(rule, "edit");
          }}
        >
          {t("rules.edit")}
        </MenuItem>
        <MenuItem
          onSelect={() => {
            onAction(rule, "top");
          }}
        >
          {t("rules.moveTop")}
        </MenuItem>
        <MenuItem
          onSelect={() => {
            onAction(rule, "up");
          }}
        >
          {t("rules.moveUp")}
        </MenuItem>
        <MenuItem
          onSelect={() => {
            onAction(rule, "down");
          }}
        >
          {t("rules.moveDown")}
        </MenuItem>
        <MenuSeparator />
        <MenuItem
          tone="danger"
          onSelect={() => {
            onAction(rule, "delete");
          }}
        >
          {t("rules.delete")}
        </MenuItem>
      </MenuContent>
    </Menu>
  );
}
