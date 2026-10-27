import {
  Card,
  CardActions,
  CardBody,
  CardFooter,
  CardHeader,
} from "@slotted/react/card";
import { Divider } from "@slotted/react/divider";
import { Heading, Text } from "@slotted/react/typography";
import { Children, Fragment } from "react";
import type { ReactNode } from "react";

import styles from "@/features/setup/settings-page.module.css";

// A card of related settings inside a pane. Its rows stand apart by a rule; actions beside the
// title and a footer hold what acts on the whole card.
export function SettingsGroup({
  title,
  description,
  actions,
  footer,
  children,
}: {
  title?: string;
  description?: string;
  actions?: ReactNode;
  footer?: ReactNode;
  children: ReactNode;
}) {
  const rows = Children.toArray(children);
  return (
    <Card>
      {title !== undefined && (
        <CardHeader>
          <Heading level={3} size="md">
            {title}
          </Heading>
          {description !== undefined && (
            <Text size="sm" tone="muted">
              {description}
            </Text>
          )}
          {actions !== undefined && <CardActions>{actions}</CardActions>}
        </CardHeader>
      )}
      <CardBody>
        <div className={styles.rows}>
          {rows.map((row, i) => (
            <Fragment key={i}>
              {i > 0 && <Divider decorative />}
              {row}
            </Fragment>
          ))}
        </div>
      </CardBody>
      {footer !== undefined && <CardFooter>{footer}</CardFooter>}
    </Card>
  );
}
