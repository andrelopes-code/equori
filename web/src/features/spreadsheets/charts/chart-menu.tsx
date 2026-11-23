import { IconButton } from "@slotted/react/button";
import { Glyph, Icon } from "@slotted/react/icon";
import {
  Menu,
  MenuContent,
  MenuItem,
  MenuRadioGroup,
  MenuRadioItem,
  MenuSeparator,
  MenuTrigger,
} from "@slotted/react/menu";

import { chartKinds } from "@/features/spreadsheets/charts/chart-table";
import type { ChartKind } from "@/features/spreadsheets/charts/chart-table";
import type { ChartTexts } from "@/features/spreadsheets/charts/chart-texts";

interface ChartMenuProps {
  kind: ChartKind;
  texts: ChartTexts;
  onKind: (kind: ChartKind) => void;
  onUseSelection: () => void;
  onRemove: () => void;
}

// What the reader changes on a chart: its kind and its cells; and its removal.
export function ChartMenu({
  kind,
  texts,
  onKind,
  onUseSelection,
  onRemove,
}: ChartMenuProps) {
  return (
    <Menu>
      <MenuTrigger
        render={(props) => (
          <IconButton
            {...props}
            size="sm"
            variant="ghost"
            tone="secondary"
            aria-label={texts.menu}
          >
            <Icon>
              <Glyph name="ellipsis" />
            </Icon>
          </IconButton>
        )}
      />

      <MenuContent>
        <MenuRadioGroup
          value={kind}
          onValueChange={(value) => {
            const next = chartKinds.find((k) => k === value);
            if (next !== undefined) onKind(next);
          }}
        >
          {chartKinds.map((k) => (
            <MenuRadioItem key={k} value={k}>
              {texts.kinds[k]}
            </MenuRadioItem>
          ))}
        </MenuRadioGroup>

        <MenuSeparator />

        <MenuItem onSelect={onUseSelection}>{texts.useSelection}</MenuItem>
        <MenuItem tone="danger" onSelect={onRemove}>
          {texts.remove}
        </MenuItem>
      </MenuContent>
    </Menu>
  );
}
