import styles from "@/features/portfolio/contribution-plan/composer/composition-editor.module.css";

const paletteSize = 8;

// The class that sets the colour of a group from the data palette.
export function slotClass(colour: number): string {
  return styles[`slot${String((colour % paletteSize) + 1)}`] ?? "";
}
