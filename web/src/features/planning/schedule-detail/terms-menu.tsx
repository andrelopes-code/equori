import { IconButton } from "@slotted/react/button";
import { Glyph, Icon } from "@slotted/react/icon";
import { Menu, MenuContent, MenuItem, MenuTrigger } from "@slotted/react/menu";

import { formatDate } from "@/i18n/format";
import { useAppLocale, useT } from "@/i18n/i18n-provider";

interface TermsMenuProps {
  date: string;
  removable: boolean;
  onRevise: () => void;
  onRemove: () => void;
}

// The latest terms version is revised or removed; the first one is revised only (A269, TR2, TR3).
export function TermsMenu({
  date,
  removable,
  onRevise,
  onRemove,
}: TermsMenuProps) {
  const t = useT();
  const [locale] = useAppLocale();

  return (
    <Menu>
      <MenuTrigger
        render={(props) => (
          <IconButton
            {...props}
            size="sm"
            variant="ghost"
            tone="secondary"
            aria-label={t("schedule.terms.actions", {
              date: formatDate(date, locale),
            })}
          >
            <Icon>
              <Glyph name="ellipsis" />
            </Icon>
          </IconButton>
        )}
      />
      <MenuContent>
        <MenuItem onSelect={onRevise}>{t("schedule.terms.revise")}</MenuItem>
        {removable && (
          <MenuItem tone="danger" onSelect={onRemove}>
            {t("schedule.terms.remove")}
          </MenuItem>
        )}
      </MenuContent>
    </Menu>
  );
}
