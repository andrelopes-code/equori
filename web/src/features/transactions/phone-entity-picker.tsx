import { Button } from "@slotted/react/button";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@slotted/react/dialog";
import type { Entity } from "@slotted/react/entity-picker";
import { useState } from "react";

import { EntitySelect } from "@/features/transactions/entity-select";
import { useT } from "@/i18n/i18n-provider";

// On a phone the picker fills the screen: the trigger shows the choice and the dialog holds the search.
export function PhoneEntityPicker({
  label,
  kind,
  entities,
  value,
  onChange,
  onCreate,
}: {
  label: string;
  kind: string;
  entities: Entity[];
  value: string;
  onChange: (id: string, entity: Entity | undefined) => void;
  onCreate?: (query: string) => Entity;
}) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const chosen = entities.find((e) => e.id === value);
  return (
    <Dialog open={open} onOpenChange={setOpen} fullScreen="always">
      <DialogTrigger
        render={(props) => (
          <Button
            {...props}
            tone="secondary"
            variant="outline"
            aria-label={label}
          >
            {chosen?.label ?? t("transactions.new.choose")}
          </Button>
        )}
      />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{label}</DialogTitle>
        </DialogHeader>
        <DialogBody>
          <EntitySelect
            defaultOpen
            label={label}
            kind={kind}
            entities={entities}
            value={value}
            {...(onCreate === undefined ? {} : { onCreate })}
            onChange={(id, entity) => {
              onChange(id, entity);
              setOpen(false);
            }}
          />
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
}
