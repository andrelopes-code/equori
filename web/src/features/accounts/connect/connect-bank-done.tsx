import { Button } from "@slotted/react/button";
import {
  DialogBody,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@slotted/react/dialog";
import { List } from "@slotted/react/list";
import {
  ListItem,
  ListItemBody,
  ListItemContent,
  ListItemDescription,
  ListItemLabel,
} from "@slotted/react/list-item";
import { useNavigate } from "@tanstack/react-router";

import type { components } from "@/api/schema.gen";
import { subtypeWords } from "@/features/accounts/model/external-subtype";
import { useT } from "@/i18n/i18n-provider";

interface ConnectBankDoneProps {
  connection: components["schemas"]["Connection"];
  onAnother: () => void;
}

// What the bank brought: the accounts still without a link, then the two ways on.
export function ConnectBankDone({
  connection,
  onAnother,
}: ConnectBankDoneProps) {
  const t = useT();
  const navigate = useNavigate();
  const pending = connection.accounts.filter((a) => a.state === "pending");
  const first = pending[0];

  function handleLink() {
    void navigate({
      to: "/accounts/links",
      search:
        first === undefined
          ? {}
          : { external: first.id, connection: connection.id },
    });
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>
          {t("links.connect.done", { name: connection.name })}
        </DialogTitle>
        <DialogDescription>{t("links.connect.doneHint")}</DialogDescription>
      </DialogHeader>

      <DialogBody>
        <List variant="ruled" aria-label={connection.name}>
          {pending.map((account) => {
            const subtype = subtypeWords[account.subtype];
            return (
              <ListItem key={account.id}>
                <ListItemContent>
                  <ListItemBody>
                    <ListItemLabel>{account.name}</ListItemLabel>
                    <ListItemDescription>
                      {subtype === undefined ? account.subtype : t(subtype)}
                    </ListItemDescription>
                  </ListItemBody>
                </ListItemContent>
              </ListItem>
            );
          })}
        </List>
      </DialogBody>

      <DialogFooter>
        <Button variant="ghost" tone="secondary" onClick={onAnother}>
          {t("links.connect.another")}
        </Button>
        <Button onClick={handleLink}>{t("links.connect.link")}</Button>
      </DialogFooter>
    </>
  );
}
