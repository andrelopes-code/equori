import { EntityPicker } from "@slotted/react/entity-picker";

import { useT } from "@/i18n/i18n-provider";

const tagPattern = /^.{1,60}$/u;

// Workaround for Slotted finding "tags-input offers no suggestions": the tags in use are
// offered by a multiple entity-picker, and a new one is created from the search.
export function TagsField({
  tags,
  value,
  onChange,
  invalid,
  placeholder,
}: {
  tags: readonly string[];
  value: readonly string[];
  onChange: (tags: string[]) => void;
  invalid?: boolean;
  placeholder?: string;
}) {
  const t = useT();
  const known = [...new Set([...tags, ...value])];
  return (
    <EntityPicker
      selectionMode="multiple"
      overflow="wrap"
      media="none"
      openOn="focus"
      items={known.map((tag) => ({ id: tag, label: tag, avatar: null }))}
      value={value}
      onValueChange={(next) => {
        onChange([...next]);
      }}
      onCreate={(query) => {
        const tag = query.trim();
        return tagPattern.test(tag)
          ? { id: tag, label: tag, avatar: null }
          : null;
      }}
      messages={{ create: t("tags.create") }}
      {...(invalid === undefined ? {} : { invalid })}
      {...(placeholder === undefined ? {} : { placeholder })}
    />
  );
}
