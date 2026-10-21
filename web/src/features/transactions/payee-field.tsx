import { EntityPicker } from "@slotted/react/entity-picker";

import type { components } from "@/api/schema.gen";
import { useCreatePayee } from "@/features/setup";
import { useT } from "@/i18n/i18n-provider";

type Payee = components["schemas"]["Payee"];

export function PayeeField({
  payees,
  value,
  onChange,
  invalid,
  placeholder,
}: {
  payees: readonly Payee[];
  value: string | null;
  onChange: (id: string | null) => void;
  invalid?: boolean;
  placeholder?: string;
}) {
  const t = useT();
  const create = useCreatePayee();
  return (
    <EntityPicker
      items={payees.map((p) => ({ id: p.id, label: p.name, avatar: null }))}
      value={value}
      media="none"
      openOn="focus"
      onValueChange={(next) => {
        onChange(next);
      }}
      onCreate={async (query) => {
        const payee = await create.mutateAsync({ name: query.trim() });
        return { id: payee.id, label: payee.name, avatar: null };
      }}
      messages={{ create: t("payee.create") }}
      {...(invalid === undefined ? {} : { invalid })}
      {...(placeholder === undefined ? {} : { placeholder })}
    />
  );
}
