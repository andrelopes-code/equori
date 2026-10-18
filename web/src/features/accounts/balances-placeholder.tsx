import { Grid } from "@slotted/react/grid";
import { List } from "@slotted/react/list";
import {
  ListItem,
  ListItemBody,
  ListItemContent,
  ListItemEnd,
  ListItemLabel,
} from "@slotted/react/list-item";
import { Skeleton, SkeletonRegion } from "@slotted/react/skeleton";
import {
  StatCard,
  StatCardFigure,
  StatCardHeader,
  StatCardLabel,
  StatCardValue,
} from "@slotted/react/stat-card";

// Two groups is the smallest set a ledger with a card holds; more groups grow the region.
const groups = [0, 1];

export function BalancesPlaceholder({
  phone,
  columns,
}: {
  phone: boolean;
  columns: 2 | 4;
}) {
  if (phone) {
    return (
      <SkeletonRegion>
        <List variant="ruled" aria-hidden="true">
          {groups.map((n) => (
            <ListItem key={n}>
              <ListItemContent>
                <ListItemBody>
                  <ListItemLabel>
                    <Skeleton shape="text" inlineSize="6rem" />
                  </ListItemLabel>
                </ListItemBody>
                <ListItemEnd>
                  <Skeleton shape="text" inlineSize="7rem" />
                </ListItemEnd>
              </ListItemContent>
            </ListItem>
          ))}
        </List>
      </SkeletonRegion>
    );
  }
  return (
    <SkeletonRegion>
      <Grid columns={columns} gap={4} minItemWidth="sm">
        {groups.map((n) => (
          <StatCard key={n} loading>
            <StatCardHeader>
              <StatCardLabel />
            </StatCardHeader>
            <StatCardFigure>
              <StatCardValue />
            </StatCardFigure>
          </StatCard>
        ))}
      </Grid>
    </SkeletonRegion>
  );
}
