import { Button } from "@slotted/react/button";
import {
  DialogBody,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@slotted/react/dialog";
import { Field, FieldDescription, FieldLabel } from "@slotted/react/field";
import { TextField } from "@slotted/react/text-field";
import { useState } from "react";
import type { SyntheticEvent } from "react";

import type { components } from "@/api/schema.gen";
import { connectLaunchers } from "@/features/accounts/connect/connect-launchers";
import { ConnectSteps } from "@/features/accounts/connect/connect-steps";
import type { useConnectBank } from "@/features/accounts/connect/use-connect-bank";
import { useT } from "@/i18n/i18n-provider";
import { ChoiceSelect } from "@/ui/form-fields/choice-select";
import { FormLayout } from "@/ui/form-layout/form-layout";
import { FormNotice } from "@/ui/form-layout/form-notice";

interface ConnectBankFormProps {
  integrations: readonly components["schemas"]["Integration"][];
  initial: string;
  connect: ReturnType<typeof useConnectBank>;
  onClose: () => void;
}

export function ConnectBankForm({
  integrations,
  initial,
  connect,
  onClose,
}: ConnectBankFormProps) {
  const t = useT();
  const [chosen, setChosen] = useState(initial);
  const [name, setName] = useState("");

  const integration =
    integrations.find((i) => i.id === chosen) ?? integrations[0];
  const launcher =
    integration === undefined
      ? undefined
      : connectLaunchers[integration.aggregator];

  function handleSubmit(event: SyntheticEvent) {
    event.preventDefault();
    if (integration === undefined || launcher === undefined) return;

    connect.start({
      integrationId: integration.id,
      name: name.trim(),
      launcher,
    });
  }

  return (
    <form onSubmit={handleSubmit}>
      <DialogHeader>
        <DialogTitle>{t("links.connect")}</DialogTitle>
        <DialogDescription>{t("links.connect.hint")}</DialogDescription>
      </DialogHeader>

      <DialogBody>
        <FormLayout fill>
          {connect.error !== null && <FormNotice>{connect.error}</FormNotice>}

          {integrations.length > 1 && (
            <Field required>
              <FieldLabel>{t("links.connect.integration")}</FieldLabel>
              <ChoiceSelect
                label={t("links.connect.integration")}
                multiple={false}
                value={integration?.id ?? null}
                choices={integrations.map((i) => ({
                  value: i.id,
                  label: i.name,
                }))}
                onChange={(next) => {
                  if (typeof next === "string") setChosen(next);
                }}
              />
            </Field>
          )}

          {launcher === undefined && (
            <FormNotice tone="info">
              {t("links.connect.unsupported")}
            </FormNotice>
          )}

          {launcher !== undefined && <ConnectSteps launcher={launcher} />}

          {launcher !== undefined && (
            <Field required>
              <FieldLabel>{t("links.connect.bank")}</FieldLabel>
              <TextField
                name="bank"
                value={name}
                maxLength={60}
                autoComplete="off"
                onChange={(event) => {
                  setName(event.target.value);
                }}
              />
              <FieldDescription>{t("links.connect.bankHint")}</FieldDescription>
            </Field>
          )}
        </FormLayout>
      </DialogBody>

      <DialogFooter>
        <Button variant="ghost" tone="secondary" onClick={onClose}>
          {t("detail.cancel")}
        </Button>
        {launcher !== undefined && (
          <Button
            type="submit"
            loading={connect.pending}
            disabled={name.trim() === ""}
          >
            {t(connect.retry ? "links.connect.retry" : "links.connect.start")}
          </Button>
        )}
      </DialogFooter>
    </form>
  );
}
