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
import { EntityPicker } from "@slotted/react/entity-picker";
import type { Entity } from "@slotted/core/entity-picker";
import { Field, FieldError, FieldLabel } from "@slotted/react/field";
import { useQuery } from "@tanstack/react-query";
import { useId, useMemo, useState } from "react";

import { errorText } from "@/api/problem";
import type { components } from "@/api/schema.gen";
import { useSetInstitutionISPB } from "@/features/accounts/api";
import { catalogueEntries } from "@/features/accounts/institution-catalogue";
import { catalogueSource } from "@/features/accounts/catalogue-search";
import {
  ispbOf,
  logoIndexQuery,
  logoURL,
} from "@/features/accounts/institution-logo";
import { useT } from "@/i18n/i18n-provider";
import { useStableCallback } from "@/ui/use-stable-callback";
import { useOverlayOpen } from "@/ui/use-overlay-open";
import { InstitutionOption } from "@/features/accounts/institution-option";

type Institution = components["schemas"]["Institution"];

// The ISPB is the key of the logo (ADR 013): choosing a catalogue entry sets it.
export function SetLogoDialog({
  institution,
  onDone,
  onCancel,
}: {
  institution: Institution;
  onDone: () => void;
  onCancel: () => void;
}) {
  const t = useT();
  const overlayOpen = useOverlayOpen();
  const formId = useId();
  const index = useQuery(logoIndexQuery);
  const save = useSetInstitutionISPB();
  const [ispb, setISPB] = useState<string | null>(ispbOf(institution) ?? null);
  const [error, setError] = useState<string | null>(null);
  const change = useStableCallback((open: boolean) => {
    if (!open) onCancel();
  });
  const items = useMemo((): Entity[] => {
    const logos = index.data;
    if (logos === undefined) return [];
    return catalogueEntries(logos, []).map((entry) => {
      const src = logoURL(logos, entry.ispb);
      return {
        id: entry.ispb,
        label: entry.name,
        description: entry.legalName,
        ...(entry.code === undefined ? {} : { meta: entry.code }),
        avatar: {
          ...(src === undefined ? {} : { src }),
          name: entry.name,
          shape: "square",
        },
      };
    });
  }, [index.data]);
  const source = useMemo(() => catalogueSource(items), [items]);
  return (
    <Dialog open={overlayOpen} size="sm" onOpenChange={change}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {t("institutions.setLogoOf", { name: institution.name })}
          </DialogTitle>
          <DialogDescription>{t("institutions.setLogoHint")}</DialogDescription>
        </DialogHeader>
        <DialogBody>
          {/* Workaround for Slotted finding "dialog has no place for a form around its parts". */}
          <form
            id={formId}
            onSubmit={(event) => {
              event.preventDefault();
              if (ispb === null) return;
              setError(null);
              save
                .mutateAsync({ id: institution.id, ispb })
                .then(onDone)
                .catch((caught: unknown) => {
                  setError(errorText(caught, t));
                });
            }}
          >
            <Field invalid={error !== null} required>
              <FieldLabel>{t("institutions.catalogueEntry")}</FieldLabel>
              <EntityPicker
                source={source}
                searchDelay={100}
                value={ispb}
                openOn="focus"
                width="anchor"
                media="none"
                // Workaround for Slotted finding "entity-picker leaves the browser's spellcheck on its input".
                spellCheck={false}
                renderOption={(entity, state) => (
                  <InstitutionOption entity={entity} query={state.query} />
                )}
                onValueChange={(next) => {
                  setISPB(typeof next === "string" ? next : null);
                }}
              />
              {error !== null && <FieldError>{error}</FieldError>}
            </Field>
          </form>
        </DialogBody>
        <DialogFooter>
          <Button variant="ghost" tone="secondary" onClick={onCancel}>
            {t("detail.cancel")}
          </Button>
          <Button
            type="submit"
            form={formId}
            loading={save.isPending}
            disabled={ispb === null}
          >
            {t("detail.save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
