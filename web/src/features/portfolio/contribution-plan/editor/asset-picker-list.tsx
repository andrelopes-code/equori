import { List, ListSection } from "@slotted/react/list";
import {
  ListItem,
  ListItemBody,
  ListItemButton,
  ListItemEnd,
  ListItemLabel,
} from "@slotted/react/list-item";
import { Text } from "@slotted/react/typography";

import type { MemberRef } from "@/features/portfolio/contribution-plan/model/plan-edits";
import { memberKey } from "@/features/portfolio/contribution-plan/editor/picker-entries";
import { useT } from "@/i18n/i18n-provider";

export interface PickerItem {
  name: string;
  // The ticker of an instrument, or the instrument of an account.
  code: string;
  ref: MemberRef;
}

interface AssetPickerListProps {
  title: string;
  items: readonly PickerItem[];
  // Member key to the name of the class that holds it.
  taken: ReadonlyMap<string, string>;
  onPick: (ref: MemberRef) => void;
}

// One group of the picker: the name in the body, the code at the end. An entry already in the
// plan is disabled and shows its class at the end in place of the code.
export function AssetPickerList({
  title,
  items,
  taken,
  onPick,
}: AssetPickerListProps) {
  const t = useT();

  if (items.length === 0) return null;

  return (
    <List size="sm">
      <ListSection label={title}>
        {items.map((item) => {
          const holder = taken.get(memberKey(item.ref));

          return (
            <ListItem
              key={memberKey(item.ref)}
              truncate
              disabled={holder !== undefined}
            >
              <ListItemButton
                onClick={() => {
                  onPick(item.ref);
                }}
              >
                <ListItemBody>
                  <ListItemLabel>{item.name}</ListItemLabel>
                </ListItemBody>

                <ListItemEnd>
                  <Text tone="muted">
                    {holder === undefined
                      ? item.code
                      : t("contributionPlan.inClass", { name: holder })}
                  </Text>
                </ListItemEnd>
              </ListItemButton>
            </ListItem>
          );
        })}
      </ListSection>
    </List>
  );
}
