import { Button } from "@slotted/react/button";
import { Card, CardActions, CardBody, CardHeader } from "@slotted/react/card";
import { Glyph, Icon } from "@slotted/react/icon";
import { Inline } from "@slotted/react/inline";
import { List, ListEmpty } from "@slotted/react/list";
import {
  ListItem,
  ListItemBody,
  ListItemDescription,
  ListItemEnd,
  ListItemLabel,
  ListItemLink,
  ListItemStart,
} from "@slotted/react/list-item";
import { Heading, Text } from "@slotted/react/typography";
import { useState } from "react";

import type { components } from "@/api/schema.gen";
import { CategoryMark, pathSeparator } from "@/features/categories";
import type { CategoryEntry } from "@/features/categories";
import { useT } from "@/i18n/i18n-provider";
import { useMoneyFormat } from "@/privacy/use-money-format";
import { useAppLink } from "@/ui/use-app-link";

type Money = components["schemas"]["Money"];

// How many categories show before the reader asks for the rest.
const firstShown = 5;

// The spending no budget covers, the largest first; a row opens the form of its budget.
export function UnbudgetedList({
  rows,
  scale,
}: {
  rows: readonly { entry: CategoryEntry; total: Money }[];
  scale: (code: string) => number;
}) {
  const t = useT();
  const fmt = useMoneyFormat();
  const follow = useAppLink();
  const [all, setAll] = useState(false);
  const shown = all ? rows : rows.slice(0, firstShown);
  const first = rows[0]?.total;
  const total =
    first === undefined
      ? undefined
      : {
          ...first,
          amount: rows.reduce((sum, r) => sum + r.total.amount, 0),
        };
  return (
    <Card fill="outline">
      <CardHeader>
        <Heading level={3} size="md">
          {t("budget.unbudgeted")}
        </Heading>
        {total !== undefined && (
          <CardActions>
            <Text size="md" weight="semibold" numeric="tabular">
              {fmt.money(total, scale(total.currency))}
            </Text>
          </CardActions>
        )}
      </CardHeader>
      <CardBody>
        <List aria-label={t("budget.unbudgeted")} variant="ruled">
          {rows.length === 0 && (
            <ListEmpty>{t("budget.unbudgetedEmpty")}</ListEmpty>
          )}
          {shown.map(({ entry, total: spent }) => {
            const parents = entry.path.split(pathSeparator).slice(0, -1);
            const search = { category: entry.id };
            return (
              <ListItem key={entry.id}>
                <ListItemLink
                  aria-label={t("budget.createFor", { name: entry.name })}
                  href={`/planning/budgets/new?${new URLSearchParams(search).toString()}`}
                  onClick={follow({ to: "/planning/budgets/new", search })}
                >
                  <ListItemStart>
                    <CategoryMark
                      name={entry.name}
                      color={entry.color}
                      icon={entry.icon}
                    />
                  </ListItemStart>
                  <ListItemBody>
                    <ListItemLabel>{entry.name}</ListItemLabel>
                    {parents.length > 0 && (
                      <ListItemDescription>
                        {parents.join(pathSeparator)}
                      </ListItemDescription>
                    )}
                  </ListItemBody>
                  <ListItemEnd>
                    <Inline gap={2} wrap="nowrap">
                      <Text size="sm" numeric="tabular">
                        {fmt.money(spent, scale(spent.currency))}
                      </Text>
                      <Icon>
                        <Glyph name="plus" />
                      </Icon>
                    </Inline>
                  </ListItemEnd>
                </ListItemLink>
              </ListItem>
            );
          })}
        </List>
        {rows.length > firstShown && (
          <Button
            variant="ghost"
            tone="secondary"
            size="sm"
            onClick={() => {
              setAll(!all);
            }}
          >
            {all
              ? t("budget.showFewer")
              : t("budget.showAll", { count: String(rows.length) })}
          </Button>
        )}
      </CardBody>
    </Card>
  );
}
