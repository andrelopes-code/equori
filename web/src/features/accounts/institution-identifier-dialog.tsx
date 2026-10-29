import { Button } from "@slotted/react/button";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@slotted/react/dialog";
import { Field, FieldError, FieldLabel } from "@slotted/react/field";
import { Inline } from "@slotted/react/inline";
import { TextField } from "@slotted/react/text-field";
import { useQuery } from "@tanstack/react-query";
import { useId, useMemo, useState } from "react";

import { useApi } from "@/api/api-context";
import { errorText } from "@/api/problem";
import type { components } from "@/api/schema.gen";
import { AccountMark } from "@/features/accounts/account-mark";
import {
  identifierSchemesQuery,
  useSetInstitutionIdentifier,
} from "@/features/accounts/api";
import { logoIndexQuery, logoOf } from "@/features/accounts/institution-logo";
import { catalogLabel } from "@/features/setup";
import { useT } from "@/i18n/i18n-provider";
import { ChoiceSelect } from "@/ui/choice-select";
import { FormLayout } from "@/ui/form-layout";
import { useOverlayOpen } from "@/ui/use-overlay-open";
import { useStableCallback } from "@/ui/use-stable-callback";

type Institution = components["schemas"]["Institution"];

// Sets or clears the identifier of an institution in a scheme the server lists (ADR 013). The
// pattern is checked here before the request; the server checks it again.
export function InstitutionIdentifierDialog({
  institution,
  onDone,
  onCancel,
}: {
  institution: Institution;
  onDone: (cleared: boolean) => void;
  onCancel: () => void;
}) {
  const t = useT();
  const api = useApi();
  const overlayOpen = useOverlayOpen();
  const formId = useId();
  const schemes = useQuery(identifierSchemesQuery(api));
  const index = useQuery(logoIndexQuery);
  const save = useSetInstitutionIdentifier();
  const [scheme, setScheme] = useState<string | null>(
    institution.identifier?.scheme ?? null,
  );
  const [identifier, setIdentifier] = useState(
    institution.identifier?.identifier ?? "",
  );
  const [error, setError] = useState<string | null>(null);
  const change = useStableCallback((open: boolean) => {
    if (!open) onCancel();
  });
  const pattern = schemes.data?.find((s) => s.id === scheme)?.pattern;
  const matches = useMemo(() => {
    if (pattern === undefined) return false;
    try {
      return new RegExp(pattern).test(identifier.trim());
    } catch {
      // A pattern this engine cannot read is left to the server.
      return true;
    }
  }, [pattern, identifier]);
  const logo =
    scheme !== null && matches
      ? logoOf({ scheme, identifier: identifier.trim() }, index.data)
      : undefined;

  const run = (body: { scheme: string; identifier: string } | null): void => {
    setError(null);
    save
      .mutateAsync({ id: institution.id, identifier: body })
      .then(() => {
        onDone(body === null);
      })
      .catch((caught: unknown) => {
        setError(errorText(caught, t));
      });
  };

  return (
    <Dialog open={overlayOpen} size="sm" onOpenChange={change}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {t("institutions.identifierOf", { name: institution.name })}
          </DialogTitle>
          <DialogDescription>
            {t("institutions.identifierHint")}
          </DialogDescription>
        </DialogHeader>
        <DialogBody>
          {/* Workaround for Slotted issue #8. */}
          <form
            id={formId}
            onSubmit={(event) => {
              event.preventDefault();
              if (scheme === null || identifier.trim() === "") return;
              if (!matches) {
                setError(t("institutions.identifierPattern"));
                return;
              }
              run({ scheme, identifier: identifier.trim() });
            }}
          >
            <FormLayout>
              <Field required>
                <FieldLabel>{t("institutions.scheme")}</FieldLabel>
                <ChoiceSelect
                  label={t("institutions.scheme")}
                  choices={(schemes.data ?? []).map((s) => ({
                    value: s.id,
                    label: catalogLabel(t, `institutions.scheme.${s.id}`, s.id),
                  }))}
                  multiple={false}
                  value={scheme}
                  onChange={(next) => {
                    setScheme(typeof next === "string" ? next : null);
                    setError(null);
                  }}
                />
              </Field>

              <Field invalid={error !== null} required>
                <FieldLabel>{t("institutions.identifier")}</FieldLabel>
                <Inline gap={3} wrap="nowrap" align="center">
                  <AccountMark
                    shape="square"
                    size="sm"
                    name={institution.name}
                    logo={logo}
                  />
                  <TextField
                    name="identifier"
                    value={identifier}
                    maxLength={40}
                    autoComplete="off"
                    spellCheck={false}
                    onChange={(event) => {
                      setIdentifier(event.target.value);
                      setError(null);
                    }}
                  />
                </Inline>
                {error !== null && <FieldError>{error}</FieldError>}
              </Field>
            </FormLayout>
          </form>
        </DialogBody>
        <DialogFooter>
          {institution.identifier !== undefined && (
            <Button
              variant="ghost"
              tone="danger"
              disabled={save.isPending}
              onClick={() => {
                run(null);
              }}
            >
              {t("institutions.clearIdentifier")}
            </Button>
          )}
          <Button variant="ghost" tone="secondary" onClick={onCancel}>
            {t("detail.cancel")}
          </Button>
          <Button
            type="submit"
            form={formId}
            loading={save.isPending}
            disabled={scheme === null || identifier.trim() === ""}
          >
            {t("detail.save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
