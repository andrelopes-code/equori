import {
  ListItem,
  ListItemBody,
  ListItemContent,
  ListItemDescription,
  ListItemLabel,
} from "@slotted/react/list-item";
import { Skeleton } from "@slotted/react/skeleton";

import { AmountLine } from "@/ui/amount-line";

export function PlaceholderRows({ count }: { count: number }) {
  return Array.from({ length: count }, (_, i) => (
    <ListItem key={i}>
      <ListItemContent>
        <ListItemBody>
          <ListItemLabel>
            <AmountLine
              own="transaction-line"
              title={<Skeleton shape="text" inlineSize="12rem" />}
              amount={<Skeleton shape="text" inlineSize="5rem" />}
            />
          </ListItemLabel>
          <ListItemDescription>
            <Skeleton shape="text" inlineSize="40%" />
          </ListItemDescription>
        </ListItemBody>
      </ListItemContent>
    </ListItem>
  ));
}
