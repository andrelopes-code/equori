import { EntityPicker } from "@slotted/react/entity-picker";
import type { Entity } from "@slotted/core/entity-picker";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useRef, useState } from "react";

import { useApi } from "@/api/api-context";
import type { components } from "@/api/schema.gen";
import { catalogueEntries } from "@/features/accounts/institution-catalogue";
import { catalogueSource } from "@/features/accounts/catalogue-search";
import { InstitutionOption } from "@/features/accounts/institution-option";
import { logoIndexQuery, logoURL } from "@/features/accounts/institution-logo";
import { institutionsQuery, useCreateInstitution } from "@/features/setup";
import { useT } from "@/i18n/i18n-provider";

type Institution = components["schemas"]["Institution"];

const cataloguePrefix = "catalogue:";

function entityOf(
  institution: Institution,
  logo: string | undefined,
  group: string,
): Entity {
  return {
    id: institution.id,
    label: institution.name,
    ...(institution.code === undefined ? {} : { meta: institution.code }),
    avatar: {
      ...(logo === undefined ? {} : { src: logo }),
      name: institution.name,
      shape: "square",
    },
    group,
  };
}

// The owner's institutions first, then the bank catalogue (ADR 013); choosing a catalogue entry
// creates the institution with its ISPB, so its logo follows every account of it.
export function InstitutionField({
  value,
  onChange,
  invalid,
  "aria-label": ariaLabel,
}: {
  value: string | null;
  // The name rides along, so a caller that just created the institution need not read it back.
  onChange: (id: string | null, name?: string) => void;
  invalid?: boolean;
  "aria-label"?: string;
}) {
  const t = useT();
  const api = useApi();
  const institutions = useQuery(institutionsQuery(api));
  const index = useQuery(logoIndexQuery);
  const create = useCreateInstitution();
  const [created, setCreated] = useState<Entity[]>([]);
  // The names of institutions created here, read before the list query has them.
  const names = useRef(new Map<string, string>());

  const items = useMemo((): Entity[] => {
    const owned = institutions.data ?? [];
    const logos = index.data;
    const mine = owned.map((i) =>
      entityOf(
        i,
        logos === undefined ? undefined : logoURL(logos, i.ispb),
        t("institutionField.mine"),
      ),
    );
    const catalogue =
      logos === undefined
        ? []
        : catalogueEntries(logos, owned).map((entry): Entity => {
            const src = logoURL(logos, entry.ispb);
            return {
              id: `${cataloguePrefix}${entry.ispb}`,
              label: entry.name,
              description: entry.legalName,
              ...(entry.code === undefined ? {} : { meta: entry.code }),
              avatar: {
                ...(src === undefined ? {} : { src }),
                name: entry.name,
                shape: "square",
              },
              group: t("institutionField.catalogue"),
            };
          });
    return [...mine, ...catalogue];
  }, [institutions.data, index.data, t]);

  const source = useMemo(() => catalogueSource(items), [items]);

  const remember = (institution: Institution): Entity => {
    const entity = entityOf(
      institution,
      index.data === undefined
        ? undefined
        : logoURL(index.data, institution.ispb),
      t("institutionField.mine"),
    );
    names.current.set(institution.id, institution.name);
    setCreated((list) => [...list, entity]);
    return entity;
  };

  return (
    <EntityPicker
      source={source}
      searchDelay={100}
      entities={created}
      value={value}
      openOn="focus"
      width="anchor"
      media="none"
      // Workaround for Slotted finding "entity-picker leaves the browser's spellcheck on its input".
      spellCheck={false}
      renderOption={(entity, state) => (
        <InstitutionOption entity={entity} query={state.query} />
      )}
      onValueChange={(next) => {
        if (typeof next !== "string") {
          onChange(null);
          return;
        }
        if (!next.startsWith(cataloguePrefix)) {
          onChange(
            next,
            items.find((i) => i.id === next)?.label ?? names.current.get(next),
          );
          return;
        }
        const ispb = next.slice(cataloguePrefix.length);
        const entry =
          index.data === undefined
            ? undefined
            : catalogueEntries(index.data, []).find((e) => e.ispb === ispb);
        if (entry === undefined) return;
        void create
          .mutateAsync({
            name: entry.name,
            ...(entry.code === undefined ? {} : { code: entry.code }),
            ispb,
          })
          .then((institution) => {
            remember(institution);
            onChange(institution.id, institution.name);
          });
      }}
      onCreate={async (query) => {
        const institution = await create.mutateAsync({ name: query.trim() });
        return remember(institution);
      }}
      messages={{ create: t("institutionField.create") }}
      {...(invalid === undefined ? {} : { invalid })}
      {...(ariaLabel === undefined ? {} : { "aria-label": ariaLabel })}
    />
  );
}
