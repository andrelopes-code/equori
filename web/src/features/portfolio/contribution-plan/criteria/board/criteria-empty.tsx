import { Button } from "@slotted/react/button";
import {
  ListItem,
  ListItemActions,
  ListItemBody,
  ListItemContent,
  ListItemDescription,
  ListItemLabel,
} from "@slotted/react/list-item";
import { List } from "@slotted/react/list";
import { Stack } from "@slotted/react/stack";
import { Text } from "@slotted/react/typography";

import { useT } from "@/i18n/i18n-provider";

interface CriteriaEmptyProps {
  onOwn: () => void;
  onPick: () => void;
}

// A group without criteria: what a criterion does and the two ways to add the first.
export function CriteriaEmpty({ onOwn, onPick }: CriteriaEmptyProps) {
  const t = useT();

  return (
    <Stack gap={4}>
      <Text>{t("contributionPlan.criteria.emptyBody")}</Text>

      <List variant="framed">
        <ListItem>
          <ListItemContent>
            <ListItemBody>
              <ListItemLabel>
                {t("contributionPlan.criteria.pickAutomatic")}
              </ListItemLabel>
              <ListItemDescription>
                {t("contributionPlan.criteria.pickAutomaticMeaning")}
              </ListItemDescription>
            </ListItemBody>
          </ListItemContent>

          <ListItemActions>
            <Button
              size="sm"
              variant="outline"
              tone="secondary"
              aria-label={t("contributionPlan.criteria.pickAutomatic")}
              onClick={onPick}
            >
              {t("contributionPlan.criteria.addOne")}
            </Button>
          </ListItemActions>
        </ListItem>

        <ListItem>
          <ListItemContent>
            <ListItemBody>
              <ListItemLabel>
                {t("contributionPlan.criteria.writeOwn")}
              </ListItemLabel>
              <ListItemDescription>
                {t("contributionPlan.criteria.writeOwnMeaning")}
              </ListItemDescription>
            </ListItemBody>
          </ListItemContent>

          <ListItemActions>
            <Button
              size="sm"
              variant="outline"
              tone="secondary"
              aria-label={t("contributionPlan.criteria.writeOwn")}
              onClick={onOwn}
            >
              {t("contributionPlan.criteria.addOne")}
            </Button>
          </ListItemActions>
        </ListItem>
      </List>
    </Stack>
  );
}
