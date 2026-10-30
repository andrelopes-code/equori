import { useAppearanceSync } from "@/features/session/use-appearance-sync";

// Keeps the member's stored appearance and this browser's copy equal (BK21).
export function AppearanceSync() {
  useAppearanceSync();

  return null;
}
