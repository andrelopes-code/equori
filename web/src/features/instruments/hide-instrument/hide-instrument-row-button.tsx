import { IconButton } from "@slotted/react/button";
import { Glyph, Icon } from "@slotted/react/icon";

import { useSetInstrumentHidden } from "@/features/instruments/api";
import type { CatalogRow } from "@/features/instruments/model/catalog-rows";
import { useT } from "@/i18n/i18n-provider";

interface HideInstrumentRowButtonProps {
  row: CatalogRow;
}

// A238 HD9: one click on the list row hides the security or shows it again, with no confirmation.
// The glyph is the state of the row; the name of the button is the action.
export function HideInstrumentRowButton({ row }: HideInstrumentRowButtonProps) {
  const t = useT();
  const setHidden = useSetInstrumentHidden();

  if (row.type === "currency") return null;

  function handleClick() {
    setHidden.mutate({ code: row.code, hidden: !row.hidden });
  }

  return (
    <IconButton
      size="sm"
      variant="ghost"
      tone="secondary"
      loading={setHidden.isPending}
      aria-label={t(
        row.hidden ? "instrument.show.row" : "instrument.hide.row",
        {
          code: row.code,
        },
      )}
      onClick={handleClick}
    >
      <Icon>
        <Glyph name={row.hidden ? "eye-off" : "eye"} />
      </Icon>
    </IconButton>
  );
}
