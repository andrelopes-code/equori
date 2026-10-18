import styles from "@/features/transactions/category-chips.module.css";

// Families read: toggle-group, chip, tag. The toggle group draws a boxed segmented row; a
// ledger offers categories as words to tap, the chosen one in ink (complete frontend F2).
export function CategoryChips({
  label,
  categories,
  value,
  onChange,
  size = "md",
}: {
  label: string;
  categories: { id: string; name: string }[];
  value: string | null;
  onChange: (id: string) => void;
  size?: "md" | "lg";
}) {
  return (
    <div
      role="group"
      aria-label={label}
      data-own="category-chips"
      data-size={size}
      className={styles.chips}
    >
      {categories.map((category) => (
        <button
          key={category.id}
          type="button"
          aria-pressed={category.id === value}
          className={styles.chip}
          onClick={() => {
            onChange(category.id);
          }}
        >
          {category.name}
        </button>
      ))}
    </div>
  );
}
