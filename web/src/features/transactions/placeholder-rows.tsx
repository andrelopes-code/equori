import {
  ListItem,
  ListItemBody,
  ListItemDescription,
  ListItemLabel,
} from "@slotted/react/list-item";
import { Skeleton } from "@slotted/react/skeleton";

export function PlaceholderRows({ count }: { count: number }) {
  return Array.from({ length: count }, (_, i) => (
    <ListItem key={i}>
      <ListItemBody>
        <ListItemLabel>
          <Skeleton shape="text" inlineSize="60%" />
        </ListItemLabel>
        <ListItemDescription>
          <Skeleton shape="text" inlineSize="40%" />
        </ListItemDescription>
      </ListItemBody>
    </ListItem>
  ));
}
