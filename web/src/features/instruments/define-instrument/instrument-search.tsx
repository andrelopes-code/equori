import {
  Combobox,
  ComboboxContent,
  ComboboxInput,
  ComboboxItem,
} from "@slotted/react/combobox";
import { Field, FieldDescription, FieldLabel } from "@slotted/react/field";
import { Text } from "@slotted/react/typography";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";

import { useApi } from "@/api/api-context";
import type { components } from "@/api/schema.gen";
import { catalogQuery } from "@/features/instruments/api";
import { sourceLabel } from "@/features/instruments/model/instrument-labels";
import { useT } from "@/i18n/i18n-provider";
import { useDebounced } from "@/ui/runtime/use-debounced";

type CatalogListing = components["schemas"]["CatalogListing"];

interface InstrumentSearchProps {
  onChoose: (listing: CatalogListing) => void;
}

const minLength = 2;

const listingKey = (l: CatalogListing) => `${l.source}:${l.code}:${l.exchange}`;

// Searches the instruments the enabled sources can quote; the server filters, so the combobox does
// not.
export function InstrumentSearch({ onChoose }: InstrumentSearchProps) {
  const t = useT();
  const api = useApi();
  const [text, setText] = useState("");
  const query = useDebounced(text.trim(), 300);
  const search = useQuery({
    ...catalogQuery(api, query),
    enabled: query.length >= minLength,
  });

  const items = search.data?.items ?? [];
  const unavailable = (search.data?.unavailable ?? []).map((s) =>
    sourceLabel(t, s),
  );
  const loading = text.trim() !== query || search.isFetching;

  const handleValueChange = (value: string | null) => {
    const listing = items.find((l) => listingKey(l) === value);
    if (listing !== undefined) onChoose(listing);
  };

  return (
    <Field necessity="none">
      <FieldLabel>{t("instruments.search.label")}</FieldLabel>
      <Combobox
        filter={null}
        inputValue={text}
        onInputValueChange={setText}
        onValueChange={handleValueChange}
        loading={loading}
      >
        <ComboboxInput />
        <ComboboxContent>
          {items.map((listing) => (
            <ComboboxItem
              key={listingKey(listing)}
              value={listingKey(listing)}
              disabled={listing.defined}
              textValue={`${listing.code} ${listing.name}`}
              description={[
                listing.exchange,
                sourceLabel(t, listing.source),
                listing.defined ? t("instruments.search.defined") : "",
              ]
                .filter((part) => part !== "")
                .join(" · ")}
            >
              {`${listing.code} ${listing.name}`.trim()}
            </ComboboxItem>
          ))}
        </ComboboxContent>
      </Combobox>
      <FieldDescription>{t("instruments.search.hint")}</FieldDescription>
      {unavailable.length > 0 && (
        <Text size="sm" tone="muted">
          {t("instruments.search.unavailable", {
            sources: unavailable.join(", "),
          })}
        </Text>
      )}
    </Field>
  );
}
