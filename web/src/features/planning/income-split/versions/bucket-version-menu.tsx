import { IconButton } from "@slotted/react/button";
import { Glyph, Icon } from "@slotted/react/icon";
import { Menu, MenuContent, MenuItem, MenuTrigger } from "@slotted/react/menu";

import { useT } from "@/i18n/i18n-provider";

interface BucketVersionMenuProps {
  onEdit: () => void;
  onDelete: () => void;
}

// The actions of one version, behind one control at the end of its header.
export function BucketVersionMenu({
  onEdit,
  onDelete,
}: BucketVersionMenuProps) {
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
            aria-label={t("buckets.version.actions")}
          >
            <Icon>
              <Glyph name="ellipsis" />
            </Icon>
          </IconButton>
        )}
      />
      <MenuContent>
        <MenuItem onSelect={onEdit}>{t("buckets.version.edit")}</MenuItem>
        <MenuItem onSelect={onDelete}>{t("buckets.version.delete")}</MenuItem>
      </MenuContent>
    </Menu>
  );
}
