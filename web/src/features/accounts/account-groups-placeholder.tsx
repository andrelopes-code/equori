import { List } from "@slotted/react/list";
import {
  ListItem,
  ListItemBody,
  ListItemContent,
  ListItemLabel,
} from "@slotted/react/list-item";
import { Skeleton, SkeletonRegion } from "@slotted/react/skeleton";

import { AmountLine } from "@/ui/amount-line";

const rows = [
  { name: "9rem", amount: "6rem" },
  { name: "7rem", amount: "5rem" },
  { name: "8rem", amount: "6rem" },
];

export function AccountGroupsPlaceholder() {
  return (
    <SkeletonRegion live="off">
      <List variant="ruled" aria-hidden="true">
        {rows.map(({ name, amount }) => (
          <ListItem key={name + amount}>
            <ListItemContent>
              <ListItemBody>
                <ListItemLabel>
                  <AmountLine
                    own="balance-line"
                    title={<Skeleton shape="text" inlineSize={name} />}
                    amount={<Skeleton shape="text" inlineSize={amount} />}
                  />
                </ListItemLabel>
              </ListItemBody>
            </ListItemContent>
          </ListItem>
        ))}
      </List>
    </SkeletonRegion>
  );
}
