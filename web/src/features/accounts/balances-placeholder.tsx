import { List } from "@slotted/react/list";
import { ListItem, ListItemBody } from "@slotted/react/list-item";
import { Skeleton, SkeletonRegion } from "@slotted/react/skeleton";
import {
  StatCard,
  StatCardFigure,
  StatCardHeader,
  StatCardLabel,
  StatCardValue,
} from "@slotted/react/stat-card";

import styles from "@/features/accounts/home-page.module.css";

export function BalancesPlaceholder() {
  return (
    <SkeletonRegion>
      <div className={styles.groups}>
        {[0, 1].map((n) => (
          <div key={n} className={styles.group}>
            <StatCard loading>
              <StatCardHeader>
                <StatCardLabel />
              </StatCardHeader>
              <StatCardFigure>
                <StatCardValue />
              </StatCardFigure>
            </StatCard>
            <List aria-hidden="true">
              {[0, 1].map((row) => (
                <ListItem key={row}>
                  <ListItemBody>
                    <Skeleton shape="text" inlineSize="50%" />
                  </ListItemBody>
                </ListItem>
              ))}
            </List>
          </div>
        ))}
      </div>
    </SkeletonRegion>
  );
}
