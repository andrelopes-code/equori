import { Button } from "@slotted/react/button";
import { Inline } from "@slotted/react/inline";
import {
  ListItem,
  ListItemActions,
  ListItemBody,
  ListItemContent,
  ListItemDescription,
  ListItemLabel,
} from "@slotted/react/list-item";
import { Tag } from "@slotted/react/tag";

import type { BookRole, BooksMember } from "@/features/setup/api";
import { formatDate } from "@/i18n/format";
import { useAppLocale, useT } from "@/i18n/i18n-provider";
import { ChoiceSelect } from "@/ui/choice-select";

interface MemberRowProps {
  member: BooksMember;
  own: boolean;
  owner: boolean;
  onRole: (role: BookRole) => void;
  onRemove: () => void;
}

const roles = ["owner", "write", "read"] as const;

export function MemberRow({
  member,
  own,
  owner,
  onRole,
  onRemove,
}: MemberRowProps) {
  const t = useT();
  const [locale] = useAppLocale();
  const choices = roles.map((role) => ({
    value: role,
    label: t(`members.role.${role}`),
  }));

  return (
    <ListItem>
      <ListItemContent>
        <ListItemBody>
          <ListItemLabel>
            <Inline gap={3}>
              {member.display_name ?? member.email}
              {own && <Tag size="sm">{t("members.you")}</Tag>}
            </Inline>
          </ListItemLabel>
          <ListItemDescription className="mt-2">
            {[
              ...(member.display_name === undefined ? [] : [member.email]),
              t(`members.role.${member.role}`),
              t("members.since", {
                date: formatDate(member.created_at.slice(0, 10), locale),
              }),
            ].join(" · ")}
          </ListItemDescription>
        </ListItemBody>
      </ListItemContent>
      {owner && (
        <ListItemActions>
          <ChoiceSelect
            label={t("members.role")}
            choices={choices}
            value={member.role}
            multiple={false}
            onChange={(next) => {
              const role = roles.find((r) => r === next);
              if (role !== undefined && role !== member.role) onRole(role);
            }}
          />
          {!own && (
            <Button size="sm" variant="ghost" tone="danger" onClick={onRemove}>
              {t("members.remove")}
            </Button>
          )}
        </ListItemActions>
      )}
    </ListItem>
  );
}
