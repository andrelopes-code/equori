import { TagsInput } from "@slotted/react/tags-input";

const tagPattern = /^.{1,60}$/u;

// The tags in use are offered as suggestions; a new one is typed whole.
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
  return (
    <TagsInput
      value={value}
      onValueChange={(next) => {
        onChange([...next]);
      }}
      suggestions={tags}
      validate={(text) => tagPattern.test(text)}
      invalidValues="refuse"
      {...(invalid === undefined ? {} : { invalid })}
      {...(placeholder === undefined ? {} : { placeholder })}
    />
  );
}
