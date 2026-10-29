import { Button, IconButton } from "@slotted/react/button";
import {
  Drawer,
  DrawerBody,
  DrawerClose,
  DrawerDescription,
  DrawerHeader,
  DrawerPanel,
  DrawerTitle,
} from "@slotted/react/drawer";
import { Field, FieldLabel } from "@slotted/react/field";
import { Glyph, Icon } from "@slotted/react/icon";
import { InlineMessage } from "@slotted/react/inline-message";
import { Stack } from "@slotted/react/stack";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableColumnHeader,
  TableContent,
  TableEmpty,
  TableHead,
  TableRow,
} from "@slotted/react/table";
import { TextField } from "@slotted/react/text-field";
import { useState } from "react";

import { errorText } from "@/api/problem";
import type { components } from "@/api/schema.gen";
import styles from "@/features/categories/aliases-drawer.module.css";
import { useCreateAlias, useDeleteAlias } from "@/features/categories/api";
import { ChoiceSelect } from "@/ui/choice-select";
import widths from "@/ui/field-width.module.css";
import type { MessageKey } from "@/i18n/catalog.en";
import { useT } from "@/i18n/i18n-provider";

type Payee = components["schemas"]["Payee"];
type PayeeAlias = components["schemas"]["PayeeAlias"];
type MatchType = PayeeAlias["match_type"];

const matchTypes: MatchType[] = ["contains", "starts_with", "equals", "regex"];

// A22: raw descriptions that name the payee when an imported line has none.
export function AliasesDrawer({
  payee,
  aliases,
  onClose,
}: {
  payee: Payee;
  aliases: readonly PayeeAlias[];
  onClose: () => void;
}) {
  const t = useT();
  const create = useCreateAlias();
  const remove = useDeleteAlias();
  const [pattern, setPattern] = useState("");
  const [matchType, setMatchType] = useState<MatchType>("contains");
  const [error, setError] = useState<string | null>(null);
  const own = aliases.filter((a) => a.payee_id === payee.id);
  const words = (type: MatchType) => t(`alias.match.${type}` as MessageKey);

  return (
    <Drawer
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      side="end"
      size="md"
    >
      <DrawerPanel>
        <DrawerHeader>
          <DrawerTitle>{t("alias.title", { name: payee.name })}</DrawerTitle>
          <DrawerDescription>{t("alias.description")}</DrawerDescription>
          <DrawerClose />
        </DrawerHeader>
        <DrawerBody>
          <Stack gap={5}>
            <form
              className={styles.add}
              onSubmit={(event) => {
                event.preventDefault();
                const text = pattern.trim();
                if (text === "") return;
                setError(null);
                create
                  .mutateAsync({
                    pattern: text,
                    match_type: matchType,
                    payee_id: payee.id,
                  })
                  .then(() => {
                    setPattern("");
                  })
                  .catch((caught: unknown) => {
                    setError(errorText(caught, t));
                  });
              }}
            >
              <Field>
                <FieldLabel>{t("alias.pattern")}</FieldLabel>
                <TextField
                  value={pattern}
                  maxLength={200}
                  mono={matchType === "regex"}
                  onChange={(event) => {
                    setPattern(event.target.value);
                  }}
                />
              </Field>
              <Field>
                <FieldLabel>{t("alias.match")}</FieldLabel>
                <ChoiceSelect
                  className={widths.medium}
                  label={t("alias.match")}
                  multiple={false}
                  choices={matchTypes.map((type) => ({
                    value: type,
                    label: words(type),
                  }))}
                  value={matchType}
                  onChange={(value) => {
                    const type = matchTypes.find((m) => m === value);
                    if (type !== undefined) setMatchType(type);
                  }}
                />
              </Field>
              <Button
                type="submit"
                loading={create.isPending}
                disabled={pattern.trim() === ""}
              >
                {t("alias.add")}
              </Button>
            </form>
            {error !== null && (
              <InlineMessage tone="danger">{error}</InlineMessage>
            )}
            <Table columns={3} variant="framed">
              <TableContent>
                <TableCaption>{t("alias.caption")}</TableCaption>
                <TableHead>
                  <TableRow>
                    <TableColumnHeader>{t("alias.pattern")}</TableColumnHeader>
                    <TableColumnHeader>{t("alias.match")}</TableColumnHeader>
                    <TableColumnHeader>
                      {t("category.actionsColumn")}
                    </TableColumnHeader>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {own.length === 0 && (
                    <TableEmpty>{t("alias.none")}</TableEmpty>
                  )}
                  {own.map((alias) => (
                    <TableRow key={alias.id}>
                      <TableCell>{alias.pattern}</TableCell>
                      <TableCell>{words(alias.match_type)}</TableCell>
                      <TableCell>
                        <IconButton
                          size="sm"
                          variant="ghost"
                          tone="secondary"
                          aria-label={t("alias.remove", {
                            pattern: alias.pattern,
                          })}
                          onClick={() => {
                            remove
                              .mutateAsync(alias.id)
                              .catch((caught: unknown) => {
                                setError(errorText(caught, t));
                              });
                          }}
                        >
                          <Icon>
                            <Glyph name="trash" />
                          </Icon>
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </TableContent>
            </Table>
          </Stack>
        </DrawerBody>
      </DrawerPanel>
    </Drawer>
  );
}
