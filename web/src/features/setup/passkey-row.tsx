import { Button } from "@slotted/react/button";
import {
  ListItem,
  ListItemActions,
  ListItemBody,
  ListItemContent,
  ListItemDescription,
  ListItemLabel,
} from "@slotted/react/list-item";

import type { Passkey } from "@/features/setup/api";
import { formatDate } from "@/i18n/format";
import { useAppLocale, useT } from "@/i18n/i18n-provider";

interface PasskeyRowProps {
  passkey: Passkey;
  onRemove: () => void;
}

export function PasskeyRow({ passkey, onRemove }: PasskeyRowProps) {
  const t = useT();
  const [locale] = useAppLocale();
  const dates = [
    t("security.passkeys.created", {
      date: formatDate(passkey.created_at.slice(0, 10), locale),
    }),
  ];

  if (passkey.last_used_at !== undefined) {
    dates.push(
      t("security.passkeys.lastUsed", {
        date: formatDate(passkey.last_used_at.slice(0, 10), locale),
      }),
    );
  }

  return (
    <ListItem>
      <ListItemContent>
        <ListItemBody>
          <ListItemLabel>{passkey.name}</ListItemLabel>
          <ListItemDescription>{dates.join(" · ")}</ListItemDescription>
        </ListItemBody>
      </ListItemContent>
      <ListItemActions>
        <Button variant="ghost" tone="danger" size="sm" onClick={onRemove}>
          {t("security.passkeys.remove")}
        </Button>
      </ListItemActions>
    </ListItem>
  );
}
